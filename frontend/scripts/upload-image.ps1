# upload-image.ps1
# 用法 (在 frontend/ 目录下):
#   $env:SERVER_HOST = "你的服务器公网IP或域名"
#   powershell -ExecutionPolicy Bypass -File scripts\upload-image.ps1
#
# 可选环境变量:
#   SERVER_USER  默认 ubuntu
#   SERVER_PORT  默认 22
#   SERVER_PATH  默认 /home/ubuntu/studymate/frontend/public/csp-difficulty-map.png
#   LOCAL_FILE   默认 frontend\public\csp-difficulty-map.png

param(
    [string]$LocalFile  = "frontend\public\csp-difficulty-map.png",
    [string]$RemoteHost = $env:SERVER_HOST,
    [string]$RemoteUser = $(if ($env:SERVER_USER) { $env:SERVER_USER } else { "ubuntu" }),
    [int]$RemotePort    = $(if ($env:SERVER_PORT) { [int]$env:SERVER_PORT } else { 22 }),
    [string]$RemotePath = $(if ($env:SERVER_PATH) { $env:SERVER_PATH } else { "/home/ubuntu/studymate/frontend/public/csp-difficulty-map.png" })
)

$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  CSP 难度地图上传脚本" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# 1) 校验本地文件
if (-not (Test-Path $LocalFile)) {
    Write-Host "[X] 本地文件不存在: $LocalFile" -ForegroundColor Red
    Write-Host "    请在 frontend/ 目录下跑本脚本" -ForegroundColor Yellow
    exit 1
}

if (-not $RemoteHost) {
    Write-Host "[X] 请先设置 SERVER_HOST 环境变量" -ForegroundColor Red
    Write-Host ""
    Write-Host "    PowerShell:" -ForegroundColor Yellow
    Write-Host "      `$env:SERVER_HOST = `"你的公网IP或域名`"" -ForegroundColor White
    Write-Host "      powershell -ExecutionPolicy Bypass -File scripts\upload-image.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "    不知道公网IP? 在服务器 1Panel 终端跑:" -ForegroundColor Yellow
    Write-Host "      curl -s ifconfig.me" -ForegroundColor White
    exit 1
}

$localSize = (Get-Item $LocalFile).Length
$localMd5  = (Get-FileHash $LocalFile -Algorithm MD5).Hash.ToLower()

Write-Host "[1/4] 本地文件" -ForegroundColor Cyan
Write-Host "      $LocalFile" -ForegroundColor White
Write-Host "      size: $localSize bytes" -ForegroundColor Gray
Write-Host "      md5:  $localMd5" -ForegroundColor Gray
Write-Host ""

Write-Host "[2/4] 远端目标" -ForegroundColor Cyan
Write-Host "      $RemoteUser@${RemoteHost}:${RemotePath}" -ForegroundColor White
Write-Host "      port: $RemotePort" -ForegroundColor Gray
Write-Host ""

# 2) Base64 编码
Write-Host "[3/4] base64 编码中..." -ForegroundColor Cyan
$bytes  = [System.IO.File]::ReadAllBytes($LocalFile)
$base64 = [Convert]::ToBase64String($bytes)
Write-Host "      encoded: $($base64.Length) chars" -ForegroundColor Gray
Write-Host ""

# 3) SSH 推送 + 远端校验 md5
Write-Host "[4/4] SSH 推送中..." -ForegroundColor Cyan
$remoteCmd = "base64 -d > $RemotePath && echo '[REMOTE-MD5]' && md5sum $RemotePath && echo '[REMOTE-SIZE]' && wc -c < $RemotePath"
$base64 | & ssh -p $RemotePort -o StrictHostKeyChecking=no -o BatchMode=yes `
    "$RemoteUser@$RemoteHost" $remoteCmd
$sshExit = $LASTEXITCODE

if ($sshExit -ne 0) {
    Write-Host ""
    Write-Host "[X] SSH 推送失败 (code $sshExit)" -ForegroundColor Red
    Write-Host ""
    Write-Host "    排查清单:" -ForegroundColor Yellow
    Write-Host "    1. 服务器公网IP对吗? (当前: $RemoteHost)" -ForegroundColor White
    Write-Host "       服务器终端跑: curl -s ifconfig.me" -ForegroundColor Gray
    Write-Host "    2. 端口对吗? 1Panel 默认可能改成 2222" -ForegroundColor White
    Write-Host "       试: `$env:SERVER_PORT = 2222" -ForegroundColor Gray
    Write-Host "    3. SSH 密钥配了吗? (本脚本 BatchMode 强制密钥, 不支持密码)" -ForegroundColor White
    Write-Host "       Windows cmd: type %USERPROFILE%\.ssh\id_rsa.pub" -ForegroundColor Gray
    Write-Host "       服务器:     cat ~/.ssh/authorized_keys" -ForegroundColor Gray
    Write-Host "    4. 22/2222 端口开放吗? 服务器防火墙拦了吗?" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "  [OK] 上传完成" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  远端 md5 应该等于: $localMd5" -ForegroundColor Yellow
Write-Host "  如果不一致, 重新跑本脚本" -ForegroundColor Gray
Write-Host ""
Write-Host "  现在强刷浏览器:" -ForegroundColor Cyan
Write-Host "    https://aijiangti.cn/csp-lecture" -ForegroundColor White
Write-Host "    按 Ctrl+Shift+R 强刷" -ForegroundColor White
Write-Host ""
