const fs = require('fs');
const data = fs.readFileSync('public/logo.jpeg');
const b64 = 'data:image/jpeg;base64,' + data.toString('base64');
fs.writeFileSync('lib/logo.ts', 'export const LOGO_BASE64 = `' + b64 + '`;');
console.log('Done, size:', b64.length);
