require('dotenv').config({ path: process.cwd() + '/.env' });
const { MongoClient, BSON } = require('mongodb');
(async () => {
  const c = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await c.connect(); const db = c.db('sfl_tracker');
  const docs = await db.collection('flip_farm_state').find({}, { projection: { savedAt: 1, fetchedAt: 1 } }).toArray();
  for (const d of docs) { const full = await db.collection('flip_farm_state').findOne({ _id: d._id }); console.log('farm', String(d._id).slice(0,4)+'…', 'bson', BSON.calculateObjectSize(full), 'json', JSON.stringify(full).length, new Date(d.savedAt).toISOString()); }
  const cols = await db.listCollections().toArray();
  for (const col of cols) { const s = await db.command({ collStats: col.name }).catch(()=>null); if (s) console.log(col.name, s.count, 'docs', Math.round(s.size/1024), 'KB avg', s.avgObjSize); }
  await c.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
