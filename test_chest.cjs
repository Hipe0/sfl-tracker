const cheerio = require('cheerio');
fetch('https://sfl.world/land/92441/chapter').then(r=>r.text()).then(html => {
  const $c = cheerio.load(html);
  let summary = {};
  $c('.accordion-item').each((i, el) => {
    const titleText = $c(el).find('.accordion-button').text().trim();
    const body = $c(el).find('.accordion-body');
    if (titleText === 'Summary') {
      body.find('.badge').each((j, sEl) => {
        let cloned = $c(sEl).clone();
        cloned.find('div').after(' ');
        const text = cloned.text().trim().replace(/\s+/g, ' ');
        const isDanger = $c(sEl).hasClass('text-bg-danger');
        const isSuccess = $c(sEl).hasClass('text-bg-success');
        const status = isDanger ? 'danger' : (isSuccess ? 'success' : 'info');
        
        if (text.includes('Daily chest') && !summary.dailyChest) summary.dailyChest = { text: text.replace('Daily chest', '').trim(), status };
      });
    }
  });
  console.log("Summary:", summary);
});
