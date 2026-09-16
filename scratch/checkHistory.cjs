require('dotenv').config();
const { MongoClient } = require('mongodb'); 
async function run() { 
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017"; 
  const client = new MongoClient(uri); 
  try {
    await client.connect(); 
    
    // Check farm controller output
    const { getGameData } = require('../src-backend/services/sflApiService.cjs');
    
    const gameData = await getGameData("6279470157500012");
    if(gameData && gameData.choreBoard) {
      console.log("Chores:");
      console.log(JSON.stringify(gameData.choreBoard.chores, null, 2));
    }
  } catch(e) {
    console.error(e);
  } finally {
    await client.close(); 
  }
} 
run();
