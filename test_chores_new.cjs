const cheerio = require('cheerio');
fetch('https://sfl.world/land/6279470157500012/chapter')
  .then(r => r.text())
  .then(html => {
    const $c = cheerio.load(html);
    let chores = [];
    $c('.accordion-item').each((i, el) => {
        const titleText = $c(el).find('.accordion-button').text().trim();
        const categoryName = titleText.replace(/[^A-Za-z\s]/g, '').trim();
        if (titleText.includes('Weekly Chores')) {
            let items = [];
            $c(el).find('.badge').each((j, bEl) => {
               const text = $c(bEl).text();
               items.push(text);
            });
            chores.push({ title: titleText, items });
        }
    });
    console.log(JSON.stringify(chores, null, 2));
  });
