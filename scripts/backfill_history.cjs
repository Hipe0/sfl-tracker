require('dotenv').config();
const { MongoClient } = require('mongodb');


const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const db = client.db('sfl_tracker');
    const historyCol = db.collection('history');
    
    const farmId = '8052347903218326';
    
    // Get history
    const history = await historyCol.findOne({ _id: farmId });
    if (!history) {
        console.log("No history found");
        return;
    }
    
    // Get SFL game data to see exact totals
    const apiKey = process.env.SFL_API_KEY;
    const res = await fetch(`https://api.sunflower-land.com/community/farms/${farmId}`, {
        headers: { 'x-api-key': apiKey }
    });
    const data = await res.json();
    const gameData = data.farm;
    
    console.log("Bounties completed:", gameData.bounties?.completed);
    console.log("Shiny Feather Collected:", gameData.farmActivity?.["Shiny Feather Collected"]);
    
    let totalTickets = 0;
    
    // Calculate current tickets in tracker
    let trackerTotal = 0;
    if (history.deliveries) {
        Object.values(history.deliveries).forEach(day => {
            day.forEach(d => {
                if (d.rewardType === 'Shiny Feather') {
                    let r = d.reward;
                    if (typeof r === 'string') r = parseInt(r.replace(/[^0-9]/g, '')) || 0;
                    trackerTotal += r;
                }
            });
        });
    }
    if (history.chores) {
        Object.values(history.chores).forEach(c => trackerTotal += (c.completed || 0));
    }
    if (history.bounties_completed) {
        Object.values(history.bounties_completed).forEach(b => trackerTotal += (b.reward || 0));
    }
    if (history.animals_completed) {
        Object.values(history.animals_completed).forEach(a => {
             if (a.rewardType === 'Shiny Feather') trackerTotal += (a.reward || 0);
        });
    }
    if (history.vip_gift) {
        Object.values(history.vip_gift).forEach(v => trackerTotal += v);
    }
    
    console.log("Tracker Total:", trackerTotal);
    
    const missing = (gameData.farmActivity?.["Shiny Feather Collected"] || 0) - trackerTotal;
    console.log("Missing tickets:", missing);
    
  } finally {
    await client.close();
  }
}

run().catch(console.dir);
