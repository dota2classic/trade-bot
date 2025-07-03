const fs = require('fs');

const raw = JSON.parse(fs.readFileSync('./cosmetics.json', 'utf-8')).lang
  .Tokens;

const marketItems = [];

Object.keys(raw)
  .filter(
    (key) => key.startsWith(`DOTA_Item_`) && !key.startsWith(`DOTA_Item_Desc_`),
  )
  .forEach((itemNameKey) => {
    marketItems.push({
      market_hash_name: raw[itemNameKey],
    });
  });


fs.writeFileSync("./items.json", JSON.stringify(marketItems, null, 2))
