const choreText = "Mine 28 Crimstone";
const choresList = [
  { name: "Mine Crimstone 28 times" }
];

const choreNum = parseInt(choreText.match(/\d+/)?.[0] || '0');
const words1 = choreText.toLowerCase().split(/\s+/).filter(w => isNaN(w) && w.length > 3 && w !== 'times');

let sflChore = choresList.find(c => {
    if (c.name.toLowerCase() === choreText.toLowerCase()) return true;
    const cNum = parseInt(c.name.match(/\d+/)?.[0] || '0');
    if (cNum !== choreNum && choreNum > 0) return false;
    
    const words2 = c.name.toLowerCase().split(/\s+/).filter(w => isNaN(w) && w.length > 3 && w !== 'times');
    return words1.some(w => words2.includes(w)) || (words1.length === 0 && words2.length === 0);
});

console.log("Found:", sflChore);
console.log("words1:", words1);
