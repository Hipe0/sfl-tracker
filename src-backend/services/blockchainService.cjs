const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Constants
const POLYGON_RPC = 'https://polygon-bor-rpc.publicnode.com'; // Public fallback RPC
const INVENTORY_CONTRACT = '0x22d5f9b75c524fec1d6619787e582644cd4d7422'; // Sunflower Land Inventory (SLI)
let TRADER_CONTRACT = '0x1DB57407EE80709D4d862fe81399FBB35B8B9586'; // Sunflower Land Trader / Marketplace

// ABI for ERC1155
const INVENTORY_ABI = [
  "function totalSupply(uint256 id) view returns (uint256)",
  "function balanceOf(address account, uint256 id) view returns (uint256)"
];

// Load id maps
let idMap = {};
let tokenIds = {};
try {
  idMap = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src/data/idMap.json'), 'utf8'));
  tokenIds = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src/data/tokenIds.json'), 'utf8'));
} catch (e) {
  console.error("Error loading id maps in blockchainService:", e.message);
}

const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
const inventoryContract = new ethers.Contract(INVENTORY_CONTRACT, INVENTORY_ABI, provider);

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getSupplyStats(itemName) {
  const now = Date.now();
  if (cache.has(itemName)) {
    const cached = cache.get(itemName);
    if (now - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }

  try {
    let numericId = tokenIds[itemName];
    if (numericId === undefined) {
       // fallback parsing
       const fullId = Object.keys(idMap).find(key => idMap[key] === itemName && key.startsWith('collectibles-')) 
                      || Object.keys(idMap).find(key => idMap[key] === itemName);
       if (fullId) {
           numericId = parseInt(fullId.split('-')[1]);
       }
    }
    
    if (numericId === undefined || isNaN(numericId)) {
        throw new Error("Item ID not found for " + itemName);
    }

    console.log(`[Blockchain] Querying Total Supply for ID ${numericId}`);
    const totalSupplyBn = await inventoryContract.totalSupply(numericId);
    
    console.log(`[Blockchain] Querying Active Supply for ID ${numericId} on Trader ${TRADER_CONTRACT}`);
    const activeSupplyBn = await inventoryContract.balanceOf(TRADER_CONTRACT, numericId);
    
    const formatValue = (bn) => {
        const str = bn.toString();
        // SFL items have 18 decimals internally for resources
        if (str.length > 15) {
            return parseFloat(ethers.formatEther(bn));
        }
        return parseFloat(str);
    };

    const total = formatValue(totalSupplyBn);
    const active = formatValue(activeSupplyBn);
    const listedPercent = total > 0 ? (active / total) * 100 : 0;

    const data = {
      total,
      active,
      listedPercent: listedPercent.toFixed(2),
      contractId: numericId
    };

    cache.set(itemName, { timestamp: now, data });
    return data;
    
  } catch (err) {
    console.error(`Blockchain fetch failed for ${itemName}:`, err.message);
    return {
      total: 0,
      active: 0,
      listedPercent: 0,
      error: err.message
    };
  }
}

module.exports = {
  getSupplyStats
};
