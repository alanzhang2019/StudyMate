const http = require('http');
const fs = require('fs');
http.get('http://localhost:3020/competitor-analysis-presentation.html', (res) => {
  fs.writeFileSync('D:\\AItrade\\AI-MATH-MISTAKE\\fetch_test3.txt', res.statusCode.toString());
}).on('error', (e) => {
  fs.writeFileSync('D:\\AItrade\\AI-MATH-MISTAKE\\fetch_test3.txt', e.message);
});
