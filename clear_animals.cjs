const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const client = new MongoClient(process.env.MONGODB_URI);
client.connect().then(async () => {
  const db = client.db(process.env.MONGODB_DB_NAME);
  const result = await db.collection('farm_history').updateMany({}, { $set: { animals: [] } });
  console.log('Cleared animals for ' + result.modifiedCount + ' farms.');
  client.close();
});
