require('dotenv').config();
const { MongoClient } = require('mongodb');

async function fixHistory() {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('sfl-tracker');
        const collection = db.collection('history');
        
        const docs = await collection.find({}).toArray();
        let updatedCount = 0;
        
        for (const doc of docs) {
            let changed = false;
            
            // Fix Animals (Chicken)
            if (doc.animals_completed) {
                for (const k of Object.keys(doc.animals_completed)) {
                    const a = doc.animals_completed[k];
                    if (a.rewardType === 'Shiny Feather') {
                        const kLower = k.toLowerCase();
                        if (kLower.includes('chicken')) {
                            // Only add if not already fixed
                            if (!a.fixed_chicken_buff) {
                                a.reward = (a.reward || 0) + 3;
                                a.fixed_chicken_buff = true;
                                changed = true;
                            }
                        }
                    }
                }
            }
            
            if (changed) {
                await collection.updateOne({ _id: doc._id }, { $set: { animals_completed: doc.animals_completed } });
                updatedCount++;
            }
        }
        
        console.log(`Updated ${updatedCount} history documents for Chicken Buff.`);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

fixHistory();
