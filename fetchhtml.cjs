const fs = require('fs');
fetch('https://sfl.world/land/8052347903218326').then(r => r.text()).then(t => {
  fs.writeFileSync('sflworld.html', t);
  console.log('Done');
});
