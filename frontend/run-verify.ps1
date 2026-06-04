$ErrorActionPreference = 'Stop'
$logPath = "D:\AItrade\AI-MATH-MISTAKE\verify-final.log"

$config = Invoke-RestMethod -Uri "http://localhost:3003/api/config/tts" -UseBasicParsing
$configStr = $config | ConvertTo-Json -Compress
Add-Content -Path $logPath -Value "Config: $configStr"

$body = @{
    text = "测试一下"
    audioId = "test_audio_123"
    ttsProviderId = "siliconflow-tts"
    ttsVoice = "FunAudioLLM/CosyVoice2-0.5B:alex"
} | ConvertTo-Json

try {
    $res = Invoke-WebRequest -Uri "http://localhost:3003/api/generate/tts" -Method Post -Body $body -ContentType "application/json" -UseBasicParsing
    Add-Content -Path $logPath -Value "TTS Status: $($res.StatusCode)"
} catch {
    Add-Content -Path $logPath -Value "TTS Error: $_"
}
