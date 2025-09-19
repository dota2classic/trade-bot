require('dotenv').config();

var SteamTotp = require('steam-totp');
var code = SteamTotp.generateAuthCode(process.env.shared_secret);

console.log('Code is:', code);
