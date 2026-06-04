const { spawn } = require('child_process');
const fs = require('fs');
const out = fs.openSync('D:\\AItrade\\AI-MATH-MISTAKE\\my-next.log', 'w');
const child = spawn('npm.cmd', ['run', 'dev', '--', '--webpack', '-p', '3001'], {
  cwd: 'D:\\AItrade\\AI-MATH-MISTAKE',
  stdio: ['ignore', out, out],
  detached: true,
  windowsHide: true
});
child.unref();
console.log('Started process ' + child.pid);
