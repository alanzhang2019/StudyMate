const { execSync } = require('child_process');
try {
  const out = execSync('git log -n 5 --oneline').toString();
  require('fs').writeFileSync('git-out.txt', out);
} catch (e) {
  require('fs').writeFileSync('git-out.txt', e.toString());
}
