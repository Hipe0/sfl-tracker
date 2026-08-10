const { MongoClient } = require('mongodb');
MongoClient.connect('mongodb+srv://hodachiep27_db_user:v2c9ZvdSX6mrsAvh@cluster0.mht6ie4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0').then(async client => {
    const db = client.db('sfl_tracker');
    const doc = await db.collection('history').findOne({ _id: '6279470157500012' });
    if (doc) {
        if (!doc.animals_completed) doc.animals_completed = {};
        
        doc.animals_completed['req_cow_11'] = { week: '2026-W33', reward: 5, rewardType: 'Shiny Feather' };
        doc.animals_completed['req_cow_5_1'] = { week: '2026-W33', reward: 3, rewardType: 'Shiny Feather' };
        doc.animals_completed['req_cow_5_2'] = { week: '2026-W33', reward: 3, rewardType: 'Shiny Feather' };
        doc.animals_completed['req_sheep_6'] = { week: '2026-W33', reward: 3, rewardType: 'Shiny Feather' };
        doc.animals_completed['req_sheep_5_1'] = { week: '2026-W33', reward: 2, rewardType: 'Shiny Feather' };
        doc.animals_completed['req_sheep_5_2'] = { week: '2026-W33', reward: 2, rewardType: 'Shiny Feather' };
        
        await db.collection('history').updateOne(
            { _id: '6279470157500012' },
            { $set: { animals_completed: doc.animals_completed } }
        );
        console.log('Restored accurate animals_completed');
    }
    client.close();
}).catch(console.error);
