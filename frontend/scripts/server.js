// 简单的静态文件服务器（用于浏览器工具访问本地文件）
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'D:/AItrade/ai-math-mistake-machine/frontend';
const PORT = 3002;

const mime = {
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  fs.readFile(fp, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('404: ' + p);
      return;
    }
    const ext = path.extname(fp).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mime[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache, must-revalidate',
    });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`LISTEN http://127.0.0.1:${PORT}`);
});
