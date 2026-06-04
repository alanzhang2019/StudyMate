const { execSync } = require('child_process');
const fs = require('fs');

try {
  const status = execSync('git status --porcelain', { cwd: 'D:\\AItrade\\StudyMate-clean' }).toString();
  fs.writeFileSync('D:\\AItrade\\ai-math-mistake-machine\\modified.txt', status);
} catch (e) {
  fs.writeFileSync('D:\\AItrade\\ai-math-mistake-machine\\modified.txt', e.toString());
}
