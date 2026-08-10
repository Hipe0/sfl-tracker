require('dotenv').config();
const { MongoClient } = require('mongodb');
MongoClient.connect(process.env.MONGODB_URI).then(async client => {
    const db = client.db('sfl_tracker');
    const doc = await db.collection('history').findOne({ _id: '6279470157500012' });
    if (doc && doc.animals_completed) {
        let changed = false;
        for (const [k, v] of Object.entries(doc.animals_completed)) {
            if (v.week === '2026-W33') {
                delete doc.animals_completed[k];
                changed = true;
            }
        }
        if (changed) {
            await db.collection('history').updateOne(
                { _id: '6279470157500012' },
                { $set: { animals_completed: doc.animals_completed } }
            );
            console.log('Cleared current week animals for 6279470157500012');
        }
    }
    client.close();
}).catch(console.error);
