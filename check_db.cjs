const { MongoClient } = require('mongodb');

async function check() {
  const uri = "mongodb+srv://admin:123@cluster0.zox20c6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('sfl_tracker');
    const col = db.collection('history');
    
    const doc = await col.findOne({ _id: "6279470157500012" });
    if (!doc) {
       console.log("No doc found!");
       return;
    }
    const today = new Date().toISOString().split('T')[0];
    console.log("Today UTC:", today);
    console.log("Deliveries keys:", Object.keys(doc.deliveries || {}));
    if (doc.deliveries && doc.deliveries[today]) {
       console.log("Today deliveries:", doc.deliveries[today]);
    } else {
       // get the latest key
       const keys = Object.keys(doc.deliveries || {}).sort();
       if (keys.length > 0) {
          const last = keys[keys.length - 1];
          console.log(`Latest date ${last}:`, doc.deliveries[last]);
       } else {
          console.log("No deliveries recorded ever");
       }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

check();
