const { spawn } = require('child_process');
const fs = require('fs');

const out = fs.openSync('D:\\AItrade\\AI-MATH-MISTAKE\\next-start.out', 'w');
const err = fs.openSync('D:\\AItrade\\AI-MATH-MISTAKE\\next-start.err', 'w');

try {
  const child = spawn('node', ['node_modules/next/dist/bin/next', 'dev', '--webpack', '-p', '3001'], {
    cwd: 'D:\\AItrade\\AI-MATH-MISTAKE',
    detached: true,
    stdio: ['ignore', out, err]
  });

  child.unref();
  fs.writeFileSync('D:\\AItrade\\AI-MATH-MISTAKE\\next-start.pid', child.pid.toString());
} catch (e) {
  fs.writeFileSync('D:\\AItrade\\AI-MATH-MISTAKE\\next-start.err', e.toString());
}
