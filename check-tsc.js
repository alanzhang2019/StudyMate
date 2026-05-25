const { execSync } = require('child_process');
const fs = require('fs');
try {
  const out = execSync('npx.cmd tsc --noEmit', { cwd: 'D:\\AItrade\\AI-MATH-MISTAKE', encoding: 'utf8' });
  fs.writeFileSync('D:\\AItrade\\AI-MATH-MISTAKE\\tsc-res.txt', 'SUCCESS:\n' + out);
} catch (e) {
  fs.writeFileSync('D:\\AItrade\\AI-MATH-MISTAKE\\tsc-res.txt', 'ERROR:\n' + e.stdout + '\n' + e.stderr);
}
