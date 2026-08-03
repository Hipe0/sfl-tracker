const cheerio = require('cheerio');

async function test() {
  const url = 'https://sfl.world/land/6279470157500012/chapter';
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);
  
  let animals = [];
  
  $('.accordion-item').each((i, el) => {
    const titleText = $(el).find('.accordion-button').text().trim();
    if (titleText.includes('Animals')) {
      const body = $(el).find('.accordion-body');
      body.find('.w75').each((j, taskEl) => {
        const level = $(taskEl).find('.w100p').text().trim();
        const imgSrc = $(taskEl).find('img').first().attr('src');
        let animalName = '';
        if (imgSrc) {
          const match = imgSrc.match(/animals\/(.+)\.png/);
          if (match) animalName = match[1];
        }
        
        const rewardText = $(taskEl).find('.m-top-5').text().trim();
        const reward = parseInt(rewardText.replace(/[^0-9]/g, '')) || 0;
        
        let status = 'not_ready';
        if ($(taskEl).hasClass('text-bg-success')) status = 'claimed';
        if ($(taskEl).hasClass('text-bg-danger')) status = 'ready'; // Danger means you don't have it? Wait, let's look at the UI.
        
        // Actually, if the legend says:
        // text-bg-success - exactly requested level (so it's ready?)
        // text-bg-info - higher than requested (so it's ready?)
        // What is warning/danger?
        let originalClasses = $(taskEl).attr('class');
        
        animals.push({ animalName, level, reward, status: originalClasses });
      });
    }
  });
  
  console.log(animals);
}

test();
