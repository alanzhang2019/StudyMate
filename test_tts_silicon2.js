const fs = require('fs');

async function test() {
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://api.siliconflow.cn/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer sk-mgpmhfjvguqcblkixbymcomfpozdbwbiweiwyrmhpjrdlkmx`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
          model: 'FunAudioLLM/CosyVoice2-0.5B',
          input: '测试语音合成是否正常工作',
          voice: 'FunAudioLLM/CosyVoice2-0.5B:alex',
          speed: 1.0,
        }),
    });
    const text = await response.text();
    fs.writeFileSync('D:\\AItrade\\AI-MATH-MISTAKE\\test_tts_out.txt', response.status + ' ' + response.statusText + '\n' + text.substring(0, 500));
  } catch (e) {
    fs.writeFileSync('D:\\AItrade\\AI-MATH-MISTAKE\\test_tts_out.txt', e.message);
  }
}

test();
