const { execSync } = require('child_process');
const fs = require('fs');

try {
  const diff = execSync('git diff', { cwd: 'D:\\AItrade\\StudyMate-clean' }).toString();
  const status = execSync('git status', { cwd: 'D:\\AItrade\\StudyMate-clean' }).toString();
  fs.writeFileSync('D:\\AItrade\\ai-math-mistake-machine\\uncommitted.txt', status + '\n' + diff);
} catch (e) {
  fs.writeFileSync('D:\\AItrade\\ai-math-mistake-machine\\uncommitted.txt', e.toString());
}
