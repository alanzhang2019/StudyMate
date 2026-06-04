const fs = require('fs');
fs.writeFileSync('benchmark-result.txt', 'Server check: ' + Date.now());
