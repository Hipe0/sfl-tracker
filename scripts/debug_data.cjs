require('dotenv').config({ path: './.env' });
const { initDB, getUsersCollection } = require('./src-backend/config/db.cjs');

async function run() {
    await initDB();
    const usersCol = getUsersCollection();
    
    const user = await usersCol.findOne({ farmId: "6279470157500012" });
    if (!user) {
        console.log("User not found!");
        process.exit(1);
    }
    
    console.log("User keys:", Object.keys(user));
    const gameData = user.farm || user.gameData || user;
    
    console.log("has bumpkin?", !!gameData.bumpkin);
    if (gameData.bumpkin) {
        console.log("bumpkin keys:", Object.keys(gameData.bumpkin));
        console.log("skills keys:", gameData.bumpkin.skills ? Object.keys(gameData.bumpkin.skills) : "no skills");
        console.log("equipped keys:", gameData.bumpkin.equipped ? Object.keys(gameData.bumpkin.equipped) : "no equipped");
    }
    
    console.log("has wardrobe?", !!gameData.wardrobe);
    if (gameData.wardrobe) {
        console.log("wardrobe Chef Apron:", gameData.wardrobe["Chef Apron"]);
    }
    
    process.exit(0);
}

run().catch(console.error);
