const { spawn } = require('child_process');
const fs = require('fs');

const out = fs.openSync('D:\\AItrade\\AI-MATH-MISTAKE\\server-out.log', 'a');
const err = fs.openSync('D:\\AItrade\\AI-MATH-MISTAKE\\server-err.log', 'a');

const child = spawn('npx.cmd', ['next', 'dev', '--port', '3001'], {
  cwd: 'D:\\AItrade\\AI-MATH-MISTAKE',
  detached: true,
  stdio: ['ignore', out, err],
  shell: true
});

child.unref();

fs.writeFileSync('D:\\AItrade\\AI-MATH-MISTAKE\\server-pid.txt', child.pid.toString());
