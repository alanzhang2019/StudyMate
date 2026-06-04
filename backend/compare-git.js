const { execSync } = require('child_process');
const fs = require('fs');

try {
  const log1 = execSync('git log -n 5 --oneline', { cwd: 'D:\\AItrade\\AI-MATH-MISTAKE' }).toString();
  const log2 = execSync('git log -n 5 --oneline', { cwd: 'D:\\AItrade\\StudyMate-clean' }).toString();
  fs.writeFileSync('D:\\AItrade\\ai-math-mistake-machine\\git-compare.txt', `AI-MATH-MISTAKE:\n${log1}\n\nStudyMate-clean:\n${log2}`);
} catch (e) {
  fs.writeFileSync('D:\\AItrade\\ai-math-mistake-machine\\git-compare.txt', e.toString());
}
