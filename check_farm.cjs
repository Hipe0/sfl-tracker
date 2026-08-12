const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://hodachiep27_db_user:v2c9ZvdSX6mrsAvh@cluster0.mht6ie4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const database = client.db('sfl_tracker'); // Guessing the DB name, let me check config/db.cjs if this fails
    const collection = database.collection('history'); // Guessing the collection name
    const farmId = '8052347903218326';
    const doc = await collection.findOne({ _id: farmId });
    console.log(JSON.stringify(doc, null, 2));
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
