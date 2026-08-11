
const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://hodachiep27_db_user:v2c9ZvdSX6mrsAvh@cluster0.mht6ie4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const client = new MongoClient(uri);
async function run() {
  try {
    await client.connect();
    const db = client.db('sfl_tracker_prod'); 
    const coll = db.collection('history');
    let doc = await coll.findOne({ _id: '73280' });
    if (!doc) doc = await coll.findOne({ _id: 73280 });
    if (doc) {
       console.log('Found doc! bounties:');
       Object.values(doc.bounties_completed).forEach(b => {
          if (b.week === '2026-W33') console.log(b.originalName || b.name, b.reward);
       });
    } else {
       console.log('Doc 73280 not found');
    }
  } finally {
    await client.close();
  }
}
run();

