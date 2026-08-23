require('dotenv').config({ path: './.env' });
const { initDB, getHistoryCollection } = require('./src-backend/config/db.cjs');
const fs = require('fs');

async function restore() {
    await initDB();
    const historyCol = getHistoryCollection();
    const farmId = "6279470157500012";
    const history = await historyCol.findOne({ _id: farmId });
    
    if (!history) return;

    // Log data manually copied from the log file
    const corrections = [
        { date: '2026-08-08', npc: "Grimbly", old: 0.4, newV: 0.6 },
        { date: '2026-08-08', npc: "Gordo", old: 0.95, newV: 1.425 },
        { date: '2026-08-08', npc: "Gambit", old: 0.85, newV: 1.275 },
        { date: '2026-08-09', npc: "Grimbly", old: 0.8, newV: 1.2 },
        { date: '2026-08-09', npc: "Gambit", old: 1.7, newV: 2.55 },
        { date: '2026-08-09', npc: "Peggy", old: 576, newV: 864 },
        { date: '2026-08-09', npc: "Gordo", old: 1.9, newV: 2.85 },
        { date: '2026-08-10', npc: "Grimbly", old: 0.4, newV: 0.6 },
        { date: '2026-08-10', npc: "Pumpkin' pete", old: 6, newV: 9 },
        { date: '2026-08-10', npc: "Timmy", old: 10, newV: 15 },
        { date: '2026-08-10', npc: "Peggy", old: 450, newV: 675 },
        { date: '2026-08-10', npc: "Gambit", old: 0.85, newV: 1.275 },
        { date: '2026-08-12', npc: "Peggy", old: 1800, newV: 2700 },
        { date: '2026-08-12', npc: "Grimbly", old: 0.5, newV: 0.75 },
        { date: '2026-08-12', npc: "Gordo", old: 0.5, newV: 0.75 },
        { date: '2026-08-12', npc: "Grimbly", old: 0.4, newV: 0.6 },
        { date: '2026-08-12', npc: "Gambit", old: 3.4, newV: 5.1 },
        { date: '2026-08-13', npc: "Peggy", old: 958, newV: 1580.7 },
        { date: '2026-08-13', npc: "Raven", old: 9, newV: 13.5 },
        { date: '2026-08-13', npc: "Grimtooth", old: 0.4, newV: 0.6 }, // Fermented carrots
        { date: '2026-08-13', npc: "Grimtooth", old: 0.4, newV: 0.792 } // Sunflower cake
    ];

    let modified = false;
    for (const corr of corrections) {
        const deliveries = history.deliveries[corr.date];
        if (deliveries) {
            for (const d of deliveries) {
                if (d.npcName === corr.npc && Math.abs(d.reward - corr.newV) < 0.001) {
                    d.reward = corr.old;
                    console.log(`Reverted ${corr.date} ${d.npcName} from ${corr.newV} back to ${corr.old}`);
                    modified = true;
                }
            }
        }
    }

    if (modified) {
        await historyCol.updateOne({ _id: farmId }, { $set: { deliveries: history.deliveries } });
        console.log("Database reverted successfully.");
    }
    
    // Now apply REAL buffs
    const communityRes = await fetch(`https://api.sunflower-land.com/community/farms/${farmId}`);
    const resData = await communityRes.json();
    const gameData = resData.farm;
    const skills = gameData?.bumpkin?.skills || {};
    const equippedItems = [];
    if (gameData?.bumpkin?.equipped) {
        equippedItems.push(...Object.values(gameData.bumpkin.equipped));
    }
    if (gameData?.farmHands?.bumpkins) {
        for (const hand of Object.values(gameData.farmHands.bumpkins)) {
            if (hand.equipped) {
                equippedItems.push(...Object.values(hand.equipped));
            }
        }
    }
    
    let buffModified = false;
    const foodRecipes = require('./src/data/foodRecipes.json');
    const history2 = await historyCol.findOne({ _id: farmId });
    for (const date of Object.keys(history2.deliveries)) {
        const deliveries = history2.deliveries[date];
        for (const d of deliveries) {
            let isFood = false;
            let isCake = false;
            if (d.reqItems) {
                for (const item of d.reqItems) {
                    if (foodRecipes[item.name]) {
                        isFood = true;
                        if (item.name.toLowerCase().includes("cake")) isCake = true;
                    }
                }
            }
            if (isFood) {
                let revMult = 1;
                // REAL BUFF LOGIC
                if (skills["Nom Nom"]) {
                    const rank = skills["Nom Nom"];
                    if (rank === 1) revMult *= 1.1;
                    else if (rank === 2) revMult *= 1.3;
                    else if (rank >= 3) revMult *= 1.5;
                }
                if (isCake && equippedItems.includes("Chef Apron")) {
                    revMult *= 1.2;
                }
                
                if (revMult > 1) {
                    // Check if already buffed (e.g. 0.48 or 1.14)
                    // If d.reward is a round number or standard unbuffed (0.4)
                    let origReward = d.reward;
                    if (d.rewardType === 'SFL' && [0.4, 0.95].includes(origReward)) {
                        d.reward = Math.round(origReward * revMult * 10000) / 10000;
                        buffModified = true;
                        console.log(`REAL BUFF: ${d.npcName} SFL reward from ${origReward} to ${d.reward} (mult: ${revMult})`);
                    } else if (d.rewardType === 'Coins') {
                         // Apply to coins only if not already buffed, assume base values are whole numbers usually (958, etc)
                         // Actually wait, 958 was reverted, so it's base.
                         d.reward = Math.round(origReward * revMult * 10000) / 10000;
                         buffModified = true;
                         console.log(`REAL BUFF: ${d.npcName} Coin reward from ${origReward} to ${d.reward} (mult: ${revMult})`);
                    }
                }
            }
        }
    }
    
    if (buffModified) {
        await historyCol.updateOne({ _id: farmId }, { $set: { deliveries: history2.deliveries } });
        console.log("Real buffs applied successfully.");
    }
    
    process.exit(0);
}

restore().catch(console.error);
