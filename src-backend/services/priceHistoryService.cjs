const { getMarketPricesCollection } = require('../config/db.cjs');

/**
 * Saves current item prices into the market_prices collection
 * @param {Object} prices - e.g. { "Sunflower": 0.0001, "Potato": 0.0002 }
 */
const recordMarketPrices = async (prices, volumes, supplies, listings) => {
  const collection = getMarketPricesCollection();
  if (!collection || !prices || Object.keys(prices).length === 0) return;

  const timestamp = Date.now();
  
  try {
    const doc = {
      timestamp: timestamp,
      prices: prices,
      volumes: volumes || {},
      supplies: supplies || {},
      listings: listings || {}
    };
    
    // Insert a new document for this timestamp
    await collection.insertOne(doc);
    console.log(`[PriceHistory] Recorded prices for ${Object.keys(prices).length} items at ${new Date(timestamp).toISOString()}`);
    
    // Auto-prune records older than 90 days
    const ninetyDaysAgo = timestamp - (90 * 24 * 60 * 60 * 1000);
    const pruneResult = await collection.deleteMany({
      $or: [
        { timestamp: { $lt: ninetyDaysAgo } },
        { timestamp: { $lt: new Date(ninetyDaysAgo) } }
      ]
    });
    if (pruneResult.deletedCount > 0) {
      console.log(`[PriceHistory] Pruned ${pruneResult.deletedCount} old records.`);
    }
  } catch (error) {
    console.error("[PriceHistory] Failed to record prices:", error);
  }
};

/**
 * Fetches OHLCV data for a specific item
 * Granularity can be '15m', '1h', '4h', '1d'
 */
const getOHLCV = async (itemName, granularity = '15m', limit = 100) => {
  const collection = getMarketPricesCollection();
  if (!collection) return [];

  // Define bucket size in milliseconds
  const bucketMap = {
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '3d': 3 * 24 * 60 * 60 * 1000,
  };
  
  const bucketSize = bucketMap[granularity] || bucketMap['15m'];
  const minTimestamp = Date.now() - (bucketSize * limit);

  try {
    const pipeline = [
      {
        $match: {
          $or: [
            { timestamp: { $gte: minTimestamp } },
            { timestamp: { $gte: new Date(minTimestamp) } }
          ],
          [`prices.${itemName}`]: { $exists: true }
        }
      },
      {
        $sort: { timestamp: 1 } // Ensure chronological order before grouping for accurate $first and $last
      },
      {
        $group: {
          _id: {
            $subtract: [
              { $toLong: "$timestamp" },
              { $mod: [{ $toLong: "$timestamp" }, bucketSize] }
            ]
          },
          open: { $first: `$prices.${itemName}` },
          high: { $max: `$prices.${itemName}` },
          low: { $min: `$prices.${itemName}` },
          close: { $last: `$prices.${itemName}` },
          firstVol: { $first: `$volumes.${itemName}` },
          lastVol: { $last: `$volumes.${itemName}` },
          supply: { $last: `$supplies.${itemName}` },
          listings: { $last: `$listings.${itemName}` }
        }
      },
      {
        $sort: { _id: 1 }
      },
      {
        $project: {
          time: { $divide: ["$_id", 1000] }, // lightweight-charts uses Unix timestamp in seconds
          open: 1,
          high: 1,
          low: 1,
          close: 1,
          volume: { $ifNull: ["$lastVol", 0] },
          active: { 
            $cond: [
              { $eq: [{ $type: "$supply" }, "object"] },
              { $ifNull: ["$supply.active", 0] },
              { $ifNull: ["$supply", 0] } // Fallback to raw number for old data
            ]
          },
          total: {
            $cond: [
              { $eq: [{ $type: "$supply" }, "object"] },
              { $ifNull: ["$supply.total", 0] },
              0 // Old data didn't have total
            ]
          },
          listedPercent: {
            $cond: [
              { $and: [
                { $eq: [{ $type: "$supply" }, "object"] },
                { $gt: ["$supply.total", 0] }
              ]},
              { $multiply: [{ $divide: ["$supply.active", "$supply.total"] }, 100] },
              0
            ]
          },
          listings: { $ifNull: ["$listings", 0] },
          _id: 0
        }
      }
    ];

    const results = await collection.aggregate(pipeline).toArray();
    
    // Fix up open/close if needed (sometimes $first/$last can be unpredictable without explicit sort before group)
    // To be perfectly accurate, we should sort before grouping.
    
    return results;
  } catch (error) {
    console.error(`[PriceHistory] Failed to fetch OHLCV for ${itemName}:`, error);
    return [];
  }
};

module.exports = { recordMarketPrices, getOHLCV };
