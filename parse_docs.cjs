const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\a9af9d7e-cf3f-4692-8219-93a185914808\\.system_generated\\steps\\108\\content.md', 'utf8');
const $ = cheerio.load(html);

// GitBook uses a div with specific classes for main content, let's just get all paragraphs and headings
let text = '';
$('h1, h2, h3, p, code, pre').each((i, el) => {
    const t = $(el).text().trim();
    if (t) text += t + '\n';
});

fs.writeFileSync('parsed_docs.txt', text);
console.log("Parsed to parsed_docs.txt. Lines:", text.split('\n').length);
