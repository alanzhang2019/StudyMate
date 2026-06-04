const { spawn } = require('child_process');
const fs = require('fs');

const child = spawn('npx.cmd', ['next', 'dev', '--webpack', '--port', '3001'], { 
  cwd: __dirname,
  stdio: 'pipe' 
});

child.stdout.on('data', d => fs.appendFileSync('preview-out.log', d));
child.stderr.on('data', d => fs.appendFileSync('preview-out.log', d));

child.on('error', (err) => {
  fs.appendFileSync('preview-out.log', err.message);
});

child.on('exit', (code) => {
  fs.appendFileSync('preview-out.log', `Exit code: ${code}`);
});

// keep alive
setInterval(() => {}, 1000);
