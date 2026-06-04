const { execSync } = require('child_process');
try {
  console.log("FE:", execSync('git log -1', { cwd: 'D:\\AItrade\\AI-MATH-MISTAKE' }).toString());
  console.log("BE:", execSync('git log -1', { cwd: 'd:\\AItrade\\ai-math-mistake-machine' }).toString());
} catch(e) {
  console.error(e.message);
}