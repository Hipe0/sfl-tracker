const fs = require('fs');
const html = fs.readFileSync('temp_boost.html', 'utf8');
const match = html.match(/var BOOST4_SOURCE_DATA = (.*?);<\/script>/);
if (match) {
  fs.writeFileSync('temp_boost_data.json', match[1]);
  console.log('Data saved.');
} else {
  console.log('Match not found.');
}
