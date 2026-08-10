const fs = require('fs');
const content = fs.readFileSync('ascension_data.js', 'utf-8');
const searchString = '{points:20,free:{items:{"Shiny Feather":10}}';
let idx = content.indexOf(searchString);
if (idx !== -1) {
  let start = content.lastIndexOf('[', idx);
  let openCount = 0;
  let end = -1;
  for (let i = start; i < content.length; i++) {
    if (content[i] === '[') openCount++;
    else if (content[i] === ']') {
      openCount--;
      if (openCount === 0) {
        end = i;
        break;
      }
    }
  }
  if (end !== -1) {
    let arr = content.substring(start, end + 1);
    fs.writeFileSync('milestones.json', arr);
    console.log('Saved to milestones.json, length: ' + arr.length);
  } else {
    console.log('End bracket not found');
  }
} else {
  console.log('Not found');
}
