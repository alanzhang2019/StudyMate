const { execSync } = require('child_process');
const fs = require('fs');

const logFile = 'D:\\AItrade\\ai-math-mistake-machine\\git-action.log';
fs.writeFileSync(logFile, 'Starting git actions...\n');

function run(cmd, cwd) {
    fs.appendFileSync(logFile, `> [${cwd}] ${cmd}\n`);
    try {
        const out = execSync(cmd, { cwd, stdio: 'pipe' }).toString();
        fs.appendFileSync(logFile, out + '\n');
        return out;
    } catch (e) {
        fs.appendFileSync(logFile, `ERROR: ${e.message}\nSTDOUT: ${e.stdout?.toString()}\nSTDERR: ${e.stderr?.toString()}\n`);
        throw e;
    }
}

try {
    const cleanDir = 'D:\\AItrade\\StudyMate-clean';
    const mainDir = 'D:\\AItrade\\AI-MATH-MISTAKE';

    // 1. Commit in StudyMate-clean
    run('git add .', cleanDir);
    try {
        run('git commit -m "fix(tts): migrate deprecated siliconflow vivian voice to alex"', cleanDir);
    } catch (e) {
        // Might be already committed
    }

    // Create branch
    try {
        run('git branch -D tts-fix', cleanDir);
    } catch(e) {}
    run('git checkout -b tts-fix', cleanDir);

    // 2. Pull into AI-MATH-MISTAKE
    run('git fetch ' + cleanDir + ' tts-fix', mainDir);
    run('git checkout main', mainDir);
    run('git reset --hard FETCH_HEAD', mainDir);

    // 3. Push to GitHub
    run('git push -f origin main', mainDir);

    fs.appendFileSync(logFile, '\nALL DONE SUCCESSFULLY!');
} catch (e) {
    fs.appendFileSync(logFile, '\nFAILED: ' + e.message);
}
