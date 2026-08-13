const fs = require('fs');
const data = JSON.parse(fs.readFileSync('api_response.json', 'utf8'));
const gameData = data.data.gameData;
console.log("Bumpkin equipped:", gameData.bumpkin?.equipped);
if (gameData.farmHands?.bumpkins) {
    for (const [id, hand] of Object.entries(gameData.farmHands.bumpkins)) {
        console.log(`Farm Hand ${id} equipped:`, hand.equipped);
    }
}
