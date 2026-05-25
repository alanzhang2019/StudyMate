const { exec } = require('child_process');
const fs = require('fs');

const child = exec('npm run dev -- --webpack -p 3001', { cwd: 'D:\\AItrade\\AI-MATH-MISTAKE' });

child.stdout.on('data', data => fs.appendFileSync('D:\\AItrade\\AI-MATH-MISTAKE\\exec-out.log', data));
child.stderr.on('data', data => fs.appendFileSync('D:\\AItrade\\AI-MATH-MISTAKE\\exec-err.log', data));

child.on('close', code => fs.appendFileSync('D:\\AItrade\\AI-MATH-MISTAKE\\exec-out.log', `\nExited with code ${code}`));

// Keep process alive for 30 seconds to see what happens
setTimeout(() => {
  child.kill();
}, 30000);
