const fs = require('fs');
const data = JSON.parse(fs.readFileSync('api_response.json', 'utf8'));
const gameData = data.data.gameData;
console.log("gameData keys:", Object.keys(gameData));
if (gameData.bumpkin) {
    console.log("bumpkin keys:", Object.keys(gameData.bumpkin));
    console.log("skills keys:", gameData.bumpkin.skills ? Object.keys(gameData.bumpkin.skills) : "no skills");
    console.log("equipped keys:", gameData.bumpkin.equipped ? Object.keys(gameData.bumpkin.equipped) : "no equipped");
} else {
    console.log("NO bumpkin! Keys in gameData:");
    console.log(Object.keys(gameData));
}
