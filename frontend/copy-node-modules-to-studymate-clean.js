const fs = require('node:fs');
const path = require('node:path');

const src = path.resolve('node_modules');
const dst = 'D:\\AItrade\\StudyMate-clean\\node_modules';

if (!fs.existsSync(src)) {
  throw new Error(`Source node_modules not found: ${src}`);
}

if (fs.existsSync(dst)) {
  console.log('SKIP: destination already exists');
  process.exit(0);
}

fs.cpSync(src, dst, { recursive: true });
console.log('COPIED');
