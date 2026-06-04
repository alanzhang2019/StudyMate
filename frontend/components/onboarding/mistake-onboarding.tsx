'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useUserProfileStore } from '@/lib/store/user-profile';
import { Sparkles, ArrowRight, Check } from 'lucide-react';

const TEACHING_STYLES = [
  { id: '幽默风趣', label: '幽默风趣', desc: '经常用比喻和笑话' },
  { id: '严谨清晰', label: '严谨清晰', desc: '步骤分明，逻辑严密' },
  { id: '鼓励为主', label: '鼓励为主', desc: '温柔耐心，充满鼓励' },
];

export function MistakeOnboarding() {
  const { saveProfile } = useUserProfileStore();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState(4);
  const [style, setStyle] = useState('幽默风趣');

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else handleComplete();
  };

  const handleComplete = async () => {
    await saveProfile({ studentName: name, grade, teachingStyle: style });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <Card className="w-full max-w-lg p-8 animate-in zoom-in-95 duration-500 shadow-clay border-4 border-white/50 bg-white">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-clay">
            <Sparkles className="text-white w-6 h-6" />
          </div>
          <h2 className="text-3xl font-heading font-bold text-primary">个性化设置</h2>
        </div>

        {step === 1 && (
          <div className="grid gap-6 animate-in fade-in slide-in-from-right-4">
            <h3 className="text-xl font-bold text-center">你好！怎么称呼你呢？</h3>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="输入你的小名（如：小明）" 
              className="text-lg text-center py-6"
            />
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-6 animate-in fade-in slide-in-from-right-4">
            <h3 className="text-xl font-bold text-center">你现在读几年级？</h3>
            <div className="flex gap-4 justify-center">
              {[4, 5, 6].map((g) => (
                <Button 
                  key={g} 
                  variant={grade === g ? 'cta' : 'outline'} 
                  onClick={() => setGrade(g)}
                  className="w-20 h-20 text-2xl"
                >
                  {g}
                </Button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-6 animate-in fade-in slide-in-from-right-4">
            <h3 className="text-xl font-bold text-center">你喜欢哪种讲课风格？</h3>
            <div className="grid gap-3">
              {TEACHING_STYLES.map((s) => (
                <Button
                  key={s.id}
                  variant={style === s.id ? 'cta' : 'outline'}
                  onClick={() => setStyle(s.id)}
                  className="h-auto py-4 flex flex-col items-center gap-1"
                >
                  <span className="text-lg">{s.label}</span>
                  <span className="text-sm font-normal opacity-80">{s.desc}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 flex justify-center">
          <Button onClick={handleNext} variant="cta" size="lg" className="w-full text-lg" disabled={step === 1 && !name.trim()}>
            {step === 3 ? (
              <>完成设置 <Check className="ml-2 w-5 h-5" /></>
            ) : (
              <>下一步 <ArrowRight className="ml-2 w-5 h-5" /></>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
