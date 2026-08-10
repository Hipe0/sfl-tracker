const { MongoClient } = require('mongodb');
require('dotenv').config();
const client = new MongoClient(process.env.MONGODB_URI);
client.connect().then(async () => {
  const db = client.db('sfl_tracker');
  const result = await db.collection('history').updateMany({}, { $set: { animals: [], animals_completed: {}, bounties: [], bounties_completed: {} } });
  console.log('Cleared animals and bounties for ' + result.modifiedCount + ' farms.');
  client.close();
});
