const { execSync } = require('child_process');
const fs = require('fs');

try {
  const log = execSync('git status', { cwd: 'D:\\AItrade\\StudyMate-clean' }).toString();
  fs.writeFileSync('D:\\AItrade\\AI-MATH-MISTAKE\\temp-status.txt', log);
} catch (e) {
  fs.writeFileSync('D:\\AItrade\\AI-MATH-MISTAKE\\temp-status.txt', e.toString());
}
