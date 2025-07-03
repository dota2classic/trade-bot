const fs = require('fs');

const raw = JSON.parse(fs.readFileSync('./items.json', 'utf-8'));

const values = raw.map(t => t.market_hash_name)


console.log(
  values.length,
  new Set(values).size
)
