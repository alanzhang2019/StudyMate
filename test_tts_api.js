const http = require('http');

async function test() {
  const req = http.request('http://localhost:3001/api/generate/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      require('fs').writeFileSync('D:\\AItrade\\AI-MATH-MISTAKE\\tts_api_test.txt', `Status: ${res.statusCode}\nBody: ${data.substring(0, 200)}`);
    });
  });

  req.on('error', (e) => {
    require('fs').writeFileSync('D:\\AItrade\\AI-MATH-MISTAKE\\tts_api_test.txt', `Error: ${e.message}`);
  });

  req.write(JSON.stringify({
    text: '测试语音合成',
    audioId: 'test-audio-1',
    ttsProviderId: 'siliconflow-tts',
    ttsVoice: 'alex' // Intentionally send without prefix to test the fallback!
  }));
  req.end();
}

test();
