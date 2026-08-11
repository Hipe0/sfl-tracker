
const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://hodachiep27_db_user:v2c9ZvdSX6mrsAvh@cluster0.mht6ie4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const client = new MongoClient(uri);
async function run() {
  try {
    await client.connect();
    const db = client.db('sfl_tracker_prod'); 
    const coll = db.collection('history');
    const docs = await coll.find({}).toArray();
    let updatedCount = 0;
    for (let doc of docs) {
       if (doc.bounties_completed) {
          let changed = false;
          Object.keys(doc.bounties_completed).forEach(key => {
             if (key.includes('PoppyBonus') && doc.bounties_completed[key].reward === 50) {
                 doc.bounties_completed[key].reward = 100;
                 changed = true;
             }
          });
          if (changed) {
             await coll.updateOne({ _id: doc._id }, { $set: { bounties_completed: doc.bounties_completed } });
             updatedCount++;
          }
       }
    }
    console.log('Migrated PoppyBonus to 100 for ' + updatedCount + ' farms.');
  } finally {
    await client.close();
  }
}
run();

