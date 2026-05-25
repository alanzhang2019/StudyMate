const http = require('http');
const fs = require('fs');

http.get('http://127.0.0.1:3001/admin/settings', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    fs.writeFileSync('D:\\AItrade\\AI-MATH-MISTAKE\\fetch-res.txt', `Status: ${res.statusCode}\n\n${data.substring(0, 500)}`);
  });
}).on('error', (err) => {
  fs.writeFileSync('D:\\AItrade\\AI-MATH-MISTAKE\\fetch-res.txt', `Error: ${err.message}`);
});
