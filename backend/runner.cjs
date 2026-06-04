const { exec } = require('child_process');
const fs = require('fs');

const fe = exec('pnpm dev', { cwd: 'D:\\AItrade\\AI-MATH-MISTAKE' });
fe.stdout.on('data', d => fs.appendFileSync('fe-run.log', d));
fe.stderr.on('data', d => fs.appendFileSync('fe-run.log', d));

const be = exec('npm run dev', { cwd: 'd:\\AItrade\\ai-math-mistake-machine' });
be.stdout.on('data', d => fs.appendFileSync('be-run.log', d));
be.stderr.on('data', d => fs.appendFileSync('be-run.log', d));
