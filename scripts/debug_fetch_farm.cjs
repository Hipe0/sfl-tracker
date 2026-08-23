require('dotenv').config({ path: './.env' });
const fs = require('fs');

async function run() {
    const farmId = '8052347903218326';
    const apiKey = process.env.SFL_API_KEY;
    
    console.log(`Fetching API for ${farmId}...`);
    const response = await fetch(`https://api.sunflower-land.com/community/farms/${farmId}`, {
        headers: {
            'x-api-key': apiKey,
            'Accept': 'application/json'
        }
    });
    
    if (response.ok) {
        const data = await response.json();
        fs.writeFileSync('debug_farm_8052347903218326.json', JSON.stringify(data, null, 2));
        console.log("Saved to debug_farm_8052347903218326.json");
    } else {
        console.log("Failed to fetch API:", response.status, response.statusText);
    }
}
run();
