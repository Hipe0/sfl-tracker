const cheerio = require('cheerio');
async function run() {
    const res = await fetch('https://sfl.world/land/6279470157500012');
    const html = await res.text();
    const $ = cheerio.load(html);
    
    $('.accordion-item').each((i, el) => {
        const titleText = $(el).find('.accordion-button').text().trim();
        if (titleText.includes('Delivery for Coins')) {
            $(el).find('.accordion-body table.m-bottom-10').each((j, tableEl) => {
                const rewardTable = $(tableEl).find('td').eq(1).find('table.p-2');
                if (rewardTable.length > 0) {
                    rewardTable.find('tr').each((k, cTrEl) => {
                        const trText = $(cTrEl).text();
                        if (trText.includes('P2P')) {
                            console.log("TR text:", trText);
                            console.log("TD0:", $(cTrEl).find('td').eq(0).text());
                            console.log("TD1:", $(cTrEl).find('td').eq(1).text());
                        }
                    });
                }
            });
        }
    });
}
run();
