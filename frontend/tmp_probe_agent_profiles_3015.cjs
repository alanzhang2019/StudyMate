const fs = require('fs');

async function main() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000);

  try {
    const res = await fetch('http://127.0.0.1:3015/api/generate/agent-profiles', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-model': 'kimi:moonshotai/kimi-k2.6',
        'x-api-key': 'sk-22a74084d0d5c4ccf235328cef65a4e6ea71240cc1fe8afc591a9031ba36dbd3',
        'x-base-url': 'https://api.qnaigc.com/v1',
      },
      body: JSON.stringify({
        stageInfo: {
          name: '四年级数学错题讲解',
          description: '36 + 27 = ?，学生答案 53，正确答案 63',
        },
        sceneOutlines: [
          { title: '找出错因', description: '分析为什么会把 36+27 算成 53' },
          { title: '正确计算', description: '演示列竖式和进位' },
        ],
        languageDirective: 'Use Chinese for the generated course.',
        availableAvatars: ['/avatars/teacher.png', '/avatars/assist.png', '/avatars/curious.png'],
        avatarDescriptions: [
          { path: '/avatars/teacher.png', desc: 'teacher avatar' },
          { path: '/avatars/assist.png', desc: 'assistant avatar' },
          { path: '/avatars/curious.png', desc: 'student avatar' },
        ],
        availableVoices: [
          {
            providerId: 'voxcpm-tts',
            voiceId: 'default',
            voiceName: 'default',
            voiceLanguage: 'zh-CN',
          },
        ],
      }),
      signal: controller.signal,
    });

    const text = await res.text();
    fs.writeFileSync('D:/AItrade/ai-math-mistake-machine/tmp_agent_profiles_probe_response.json', text);
    console.log(`STATUS=${res.status}`);
    console.log(`LEN=${text.length}`);
    console.log('OUT=D:/AItrade/ai-math-mistake-machine/tmp_agent_profiles_probe_response.json');
  } finally {
    clearTimeout(timeout);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
