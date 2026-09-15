async function run() {
  const url = 'https://sunflower-land.com/community-docs/assets/index--he01vAV.js';
  try {
    const res = await fetch(url);
    const text = await res.text();
    const regex = /https?:\/\/[^\s\"\'\`]+/g;
    const matches = text.match(regex) || [];
    const endpoints = Array.from(new Set(matches)).filter(e => e.includes('api.sunflower'));
    console.log("Found endpoints:", endpoints);
    
    // Also look for community/data types
    const types = text.match(/type=[a-zA-Z]+/g);
    if (types) {
        console.log("Found types:", Array.from(new Set(types)));
    }
  } catch(e) { console.error(e); }
}
run();
