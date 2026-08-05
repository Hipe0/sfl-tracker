const { MongoClient } = require('mongodb');

async function fix() {
  const uri = "mongodb+srv://hodachiep27_db_user:v2c9ZvdSX6mrsAvh@cluster0.mht6ie4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('sfl_tracker');
    const col = db.collection('history');
    
    const today = new Date().toISOString().split('T')[0];
    
    // Add the missing Peggy completion
    const updateResult = await col.updateOne(
       { _id: "6279470157500012" },
       { 
         $push: { 
            [`deliveries.${today}`]: {
               npcName: "Peggy",
               reward: 516,
               rewardType: "Coins",
               reqItems: []
            }
         }
       }
    );
    console.log("Updated:", updateResult.modifiedCount);
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

fix();
