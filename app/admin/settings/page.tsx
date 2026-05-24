'use client';
import { useState, useEffect } from 'react';

// Define the available voices for each provider
const PROVIDER_VOICES = {
  'siliconflow-tts': [
    { id: 'FunAudioLLM/CosyVoice2-0.5B:alex', name: 'Alex (男声)' },
    { id: 'FunAudioLLM/CosyVoice2-0.5B:diana', name: 'Diana (女声)' },
    { id: 'FunAudioLLM/CosyVoice2-0.5B:bella', name: 'Bella (热情女声)' },
    { id: 'FunAudioLLM/CosyVoice2-0.5B:anna', name: 'Anna (温柔女声)' },
  ],
  'openai-tts': [
    { id: 'alloy', name: 'Alloy' },
    { id: 'echo', name: 'Echo' },
    { id: 'fable', name: 'Fable' },
    { id: 'onyx', name: 'Onyx' },
    { id: 'nova', name: 'Nova' },
    { id: 'shimmer', name: 'Shimmer' },
  ]
};

export default function SettingsPage() {
  const [config, setConfig] = useState({ provider: 'siliconflow-tts', voice: 'FunAudioLLM/CosyVoice2-0.5B:alex' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/config')
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('加载配置失败');
        }
        const text = await res.text();
        return text ? JSON.parse(text) : { provider: 'siliconflow-tts', voice: 'FunAudioLLM/CosyVoice2-0.5B:alex' };
      })
      .then((data) => {
        setConfig(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value as keyof typeof PROVIDER_VOICES;
    // When switching providers, automatically select the first voice of the new provider
    const newVoice = PROVIDER_VOICES[newProvider]?.[0]?.id || '';
    setConfig({ provider: newProvider, voice: newVoice });
  };

  const handleSave = async () => {
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      
      if (!res.ok) throw new Error('保存失败');
      alert('保存成功');
    } catch (err) {
      alert('保存配置失败');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 md:p-12 flex items-center justify-center">
        <div className="text-slate-500 font-medium">正在加载作业通设置...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 md:p-12 flex items-center justify-center">
        <div className="text-red-500 font-medium">加载失败：{error}</div>
      </div>
    );
  }

  const currentVoices = PROVIDER_VOICES[config.provider as keyof typeof PROVIDER_VOICES] || [];

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="bg-white p-8 rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-100 max-w-2xl mx-auto">
        <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight mb-6">作业通全局语音设置</h2>
        <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">服务商</label>
          <select 
            className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-slate-700 font-medium focus:border-sky-400 focus:ring-4 focus:ring-sky-400/20 transition-all outline-none cursor-pointer" 
            value={config.provider} 
            onChange={handleProviderChange}
          >
            <option value="siliconflow-tts">SiliconFlow</option>
            <option value="openai-tts">OpenAI</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">音色</label>
          <select 
            className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-slate-700 font-medium focus:border-sky-400 focus:ring-4 focus:ring-sky-400/20 transition-all outline-none cursor-pointer" 
            value={config.voice} 
            onChange={e => setConfig({...config, voice: e.target.value})}
          >
            {currentVoices.map(voice => (
              <option key={voice.id} value={voice.id}>
                {voice.name} ({voice.id})
              </option>
            ))}
          </select>
        </div>
        <button 
          onClick={handleSave} 
          className="bg-sky-500 hover:bg-sky-400 text-white rounded-xl shadow-md shadow-sky-500/30 font-bold px-6 py-3 mt-8 w-full md:w-auto transition-all active:scale-95"
        >
          保存设置
        </button>
        </div>
      </div>
    </div>
  );
}
