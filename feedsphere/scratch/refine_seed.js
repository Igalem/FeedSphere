
const fs = require('fs');

const seedPath = 'sql/seed_rss_feeds.sql';
let content = fs.readFileSync(seedPath, 'utf8');

const gamingKeywords = [
    'game', 'gamer', 'gaming', 'polygon', 'ign', 'steam', 'eurogamer',
    'escapist', 'nintendo', 'playstation', 'xbox', 'kotaku', 'destructoid',
    'rockpapershotgun', 'indiegames', 'gematsu', 'pcgamer'
];

const lines = content.split('\n');
const newLines = lines.map(line => {
    if (line.includes("'Entertainment'")) {
        const matches = gamingKeywords.some(kw => line.toLowerCase().includes(kw));
        if (matches) {
            return line.replace("'Entertainment'", "'Gaming'");
        }
    }
    return line;
});

fs.writeFileSync(seedPath, newLines.join('\n'));
console.log('✅ Seed file refined for Gaming topics.');
