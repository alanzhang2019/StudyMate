const http = require('http');

http.get('http://localhost:3000', (res) => {
  console.log(`BE (3000) Status: ${res.statusCode}`);
}).on('error', (e) => {
  console.error(`BE (3000) Error: ${e.message}`);
});

http.get('http://localhost:3001', (res) => {
  console.log(`FE (3001) Status: ${res.statusCode}`);
}).on('error', (e) => {
  console.error(`FE (3001) Error: ${e.message}`);
});