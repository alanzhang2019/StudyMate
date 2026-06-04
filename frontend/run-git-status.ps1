$ErrorActionPreference = 'Continue'
Set-Location "D:\AItrade\StudyMate-clean"
$out = git status
Set-Content -Path "D:\AItrade\AI-MATH-MISTAKE\git-status.txt" -Value $out -Encoding utf8
