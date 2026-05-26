const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectDir = 'D:\\AItrade\\StudyMate-clean';
const outPath = path.join(projectDir, '.next-dev-3003.out.log');
const errPath = path.join(projectDir, '.next-dev-3003.err.log');

const out = fs.openSync(outPath, 'a');
const err = fs.openSync(errPath, 'a');

const child = spawn('pnpm.cmd', ['exec', 'next', 'dev', '--webpack', '-p', '3003'], {
  cwd: projectDir,
  detached: true,
  stdio: ['ignore', out, err],
  windowsHide: true,
});

child.unref();

console.log(`STARTED:${child.pid}`);
