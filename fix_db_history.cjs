const { MongoClient } = require('mongodb');

const fixedFeathers = { "pumpkin' pete": 6, "bert": 7, "miranda": 7, "finley": 7, "raven": 9, "finn": 10, "timmy": 10, "cornwell": 8, "jester": 9, "pharaoh": 11, "tywin": 15 };

MongoClient.connect('mongodb+srv://hodachiep27_db_user:v2c9ZvdSX6mrsAvh@cluster0.mht6ie4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0').then(async client => {
    const db = client.db('sfl_tracker');
    const doc = await db.collection('history').findOne({ _id: '6279470157500012' });
    if (doc) {
        let changed = false;
        
        // Fix Deliveries
        if (doc.deliveries) {
            for (const dateStr of Object.keys(doc.deliveries)) {
                for (let i = 0; i < doc.deliveries[dateStr].length; i++) {
                    const d = doc.deliveries[dateStr][i];
                    if (d.rewardType === 'Shiny Feather' || d.rewardType === 'Unknown') {
                        const npcKey = (d.npcName || '').toLowerCase();
                        if (fixedFeathers[npcKey]) {
                            // Only update if it's currently stored as a number/string that is different
                            // Wait, if it's "1" or 1, we replace it with fixedFeathers[npcKey]
                            d.reward = fixedFeathers[npcKey];
                            d.rewardType = 'Shiny Feather'; // Ensure it's Shiny Feather
                            changed = true;
                        }
                    }
                }
            }
        }
        
        // Fix Active Deliveries
        if (doc.active_deliveries) {
            for (const key of Object.keys(doc.active_deliveries)) {
                const d = doc.active_deliveries[key];
                if (d.rewardType === 'Shiny Feather' || d.rewardType === 'Unknown') {
                    const npcKey = (d.npcName || '').toLowerCase();
                    if (fixedFeathers[npcKey]) {
                        d.reward = fixedFeathers[npcKey];
                        d.rewardType = 'Shiny Feather';
                        changed = true;
                    }
                }
            }
        }

        // Fix Animals
        if (doc.animals_completed) {
            for (const k of Object.keys(doc.animals_completed)) {
                const a = doc.animals_completed[k];
                if (a.rewardType === 'Shiny Feather') {
                    const kLower = k.toLowerCase();
                    if (kLower.includes('cow') || kLower.includes('sheep')) {
                        // The user said "chưa cộng 3 của các nft". So add 3.
                        // But wait, if they run the script multiple times, it will keep adding 3!
                        // Let's check if we ALREADY added 3 by checking a flag or just adding it once.
                        if (!a.fixed_nft_buff) {
                            a.reward = (a.reward || 0) + 3;
                            a.fixed_nft_buff = true;
                            changed = true;
                        }
                    }
                }
            }
        }
        
        if (changed) {
            await db.collection('history').updateOne(
                { _id: '6279470157500012' },
                { $set: { deliveries: doc.deliveries, active_deliveries: doc.active_deliveries, animals_completed: doc.animals_completed } }
            );
            console.log('Fixed DB history successfully!');
        } else {
            console.log('No changes needed in DB.');
        }
    }
    client.close();
}).catch(console.error);
