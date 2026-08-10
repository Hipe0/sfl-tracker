const { MongoClient } = require('mongodb');
MongoClient.connect('mongodb://127.0.0.1:27017/sfl-tracker').then(client => {
    const db = client.db();
    db.collection('farm_history').findOne({ _id: '6279470157500012' }).then(doc => {
        if (doc && doc.animals_completed) {
            let total = 0;
            console.log('Animals Completed for 2026-W33 (current week):');
            for (const [k, v] of Object.entries(doc.animals_completed)) {
                if (v.week === '2026-W33') {
                    console.log(k, v);
                    total += v.reward || 0;
                }
            }
            console.log('Calculated sum for 2026-W33:', total);
        } else {
            console.log('No doc or no animals_completed found.');
        }
        client.close();
    });
});
