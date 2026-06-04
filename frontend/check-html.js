const fs = require('fs');
const html = fs.readFileSync('classroom-test-mid.html', 'utf8');
console.log('HTML Length:', html.length);
const text = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
console.log('Page text:', text.substring(0, 1000));