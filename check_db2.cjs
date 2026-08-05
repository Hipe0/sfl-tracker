const { MongoClient } = require('mongodb');

async function check() {
  const uri = "mongodb+srv://hodachiep27_db_user:v2c9ZvdSX6mrsAvh@cluster0.mht6ie4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('sfl_tracker');
    const col = db.collection('history');
    
    const doc = await col.findOne({ _id: "6279470157500012" });
    if (doc) {
       console.log("active_deliveries keys:", Object.keys(doc.active_deliveries || {}));
       for (const key in doc.active_deliveries) {
           console.log(`- ${key}:`, doc.active_deliveries[key].data.reward);
       }
       console.log("npc_stats for peggy:", doc.npc_stats['peggy']);
       console.log("Deliveries today:", doc.deliveries[new Date().toISOString().split('T')[0]]);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

check();
