$ErrorActionPreference = 'Stop'
Set-Location "D:\AItrade\StudyMate-clean"
git commit -a -m "fix: migrate deprecated siliconflow vivian voice to alex (based on 558a3c9)"
git branch -f stable-fast HEAD
Set-Location "D:\AItrade\AI-MATH-MISTAKE"
git fetch "D:\AItrade\StudyMate-clean" stable-fast
git checkout main
git reset --hard FETCH_HEAD
git push -f origin main
Write-Output "DONE"
