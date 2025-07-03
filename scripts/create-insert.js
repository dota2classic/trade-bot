const fs = require('fs');

const qualities = [
  (Standard = 'Standard'),
  (Inscribed = 'Inscribed'),
  (Auspicious = 'Auspicious'),
  (Genuine = 'Genuine'),
  (Autographed = 'Autographed'),
  (Heroic = 'Heroic'),
  (Frozen = 'Frozen'),
  (Base = 'Base'),
  (Cursed = 'Cursed'),
  (Unusual = 'Unusual'),
  (Infused = 'Infused'),
  (Corrupted = 'Corrupted'),
  (Exalted = 'Exalted'),
  (Elder = 'Elder'),
  (Glitter = 'Glitter'),
  (Gold = 'Gold'),
  (Holo = 'Holo'),
  (Legacy = 'Legacy'),
  (Favored = 'Favored'),
  (Ascendant = 'Ascendant'),
];

const raw = JSON.parse(fs.readFileSync('./items.json', 'utf-8'));

const banwords = [
  'Compendium Points',
  'Battle Points',
  'League',
  'Battle Point Booster',
  'Battle Bonus',
  'Beast Ability Points',
  'Tournament',
  'VPGAME',
  'Ticket',
  ' - ADMIN',
  'Cup Season',
  'Dota 2',
  ' CUP',
  'Compendium Levels',
  'The Summit ',
  'The defense',
  'ADMIN',
  'ESL One ',
  'Season',
  'Challenge',
  '2014',
  '2015',
  '2013',
  'Liga',
  'dota',
  'Championship',
  'esports',
  'Player Card',
  'Present',
];
const whitelist = [
  'Roshan Hunter & G-League Bundle',
  'Loading screen',
  'Eternal Seasons',
  'HUD',
  'Music Pack',
  'Bundle',
  'Cursor Pack',
  'Emoticon Pack',
  'Announcer',
  'mousesports',
];

const isBanned = (r) =>
  banwords.findIndex((banword) =>
    r.toLowerCase().includes(banword.toLowerCase()),
  ) !== -1;

const isWhiteListed = (r) =>
  whitelist.findIndex((wl) => r.toLowerCase().includes(wl.toLowerCase())) !==
  -1;

const s = raw
  .map((t) => t.market_hash_name)
  .filter((t) => isWhiteListed(t) || !isBanned(t));

fs.writeFileSync('items_wearable.json', JSON.stringify(s, null, 2));

const values = s.flatMap((item) => {
  return qualities.map((quality) => [item, quality, 0, ''].join(';'));
});

const header = `market_hash_name;quality;price;type`;
fs.writeFileSync('test.csv', header + '\n' + values.join('\n'));
