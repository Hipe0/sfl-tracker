import * as cheerio from 'cheerio';

async function testScrape() {
  const res = await fetch('https://sfl.world/land/160167/chapter');
  const htmlString = await res.text();
  const doc = cheerio.load(htmlString);
  const choreElements = doc('#collapseChores .badge');
  const chores = [];
  
  choreElements.each((index, el) => {
    const $el = doc(el);
    const titleEl = $el.find('.mb-auto.h6.text-wrap');
    if (titleEl.length === 0) return;
    const title = titleEl.text().trim();
    
    const rightPanel = $el.find('.ta-right');
    let completed = 0, total = 1, reward = 0;
    
    if (rightPanel.length > 0) {
      const smallEl = rightPanel.find('small');
      const bEl = rightPanel.find('b');
      
      if (smallEl.length > 0 && bEl.length > 0) {
        completed = parseInt(smallEl.text().replace(/[^0-9]/g, '')) || 0;
        total = parseInt(bEl.text().replace(/[^0-9]/g, '')) || 1;
      }
      
      const divs = rightPanel.find('> div > div');
      if (divs.length > 0) {
        const lastDiv = doc(divs[divs.length - 1]);
        reward = parseInt(lastDiv.text().replace(/[^0-9]/g, '')) || 0;
      }
    }
    
    chores.push({
      id: index,
      name: title,
      completed,
      total,
      reward,
      status: completed >= total ? 'completed' : (completed > 0 ? 'in-progress' : 'pending')
    });
  });

  console.dir(chores, { depth: null });
}
testScrape();
