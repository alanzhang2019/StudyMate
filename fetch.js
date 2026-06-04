const http = require('http');
http.get('http://localhost:3001/admin/settings', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    require('fs').writeFileSync('d:\\AItrade\\ai-math-mistake-machine\\fetch-res.txt', `Status: ${res.statusCode}\n\n${data.substring(0, 500)}`);
  });
}).on('error', (err) => {
  require('fs').writeFileSync('d:\\AItrade\\ai-math-mistake-machine\\fetch-res.txt', `Error: ${err.message}`);
});
