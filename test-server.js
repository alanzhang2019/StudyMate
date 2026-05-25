const http = require('http');
http.get('http://localhost:3001/admin/settings', (res) => {
  const fs = require('fs');
  fs.writeFileSync('D:\\AItrade\\AI-MATH-MISTAKE\\test-server-result.txt', `Status: ${res.statusCode}`);
}).on('error', (err) => {
  const fs = require('fs');
  fs.writeFileSync('D:\\AItrade\\AI-MATH-MISTAKE\\test-server-result.txt', `Error: ${err.message}`);
});
