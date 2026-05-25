const fetch = require('node-fetch');

async function test() {
  const response = await fetch('https://api.siliconflow.cn/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer sk-mgpmhfjvguqcblkixbymcomfpozdbwbiweiwyrmhpjrdlkmx`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
        model: 'FunAudioLLM/CosyVoice2-0.5B',
        input: '测试语音合成是否正常工作',
        voice: 'alex',
        speed: 1.0,
      }),
  });
  console.log(response.status, response.statusText);
  const text = await response.text();
  console.log(text.substring(0, 500));
}

test();
