@echo off
echo Running git commands... > D:\AItrade\ai-math-mistake-machine\do.log
cd /d D:\AItrade\StudyMate-clean
git status >> D:\AItrade\ai-math-mistake-machine\do.log 2>&1
git add . >> D:\AItrade\ai-math-mistake-machine\do.log 2>&1
git commit -m "fix(tts): migrate deprecated siliconflow vivian voice to alex" >> D:\AItrade\ai-math-mistake-machine\do.log 2>&1
git branch -D tts-fix >> D:\AItrade\ai-math-mistake-machine\do.log 2>&1
git checkout -b tts-fix >> D:\AItrade\ai-math-mistake-machine\do.log 2>&1

cd /d D:\AItrade\AI-MATH-MISTAKE
git fetch D:\AItrade\StudyMate-clean tts-fix >> D:\AItrade\ai-math-mistake-machine\do.log 2>&1
git checkout main >> D:\AItrade\ai-math-mistake-machine\do.log 2>&1
git reset --hard FETCH_HEAD >> D:\AItrade\ai-math-mistake-machine\do.log 2>&1
git push -f origin main >> D:\AItrade\ai-math-mistake-machine\do.log 2>&1

echo DONE >> D:\AItrade\ai-math-mistake-machine\do.log
