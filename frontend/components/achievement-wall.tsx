import { Award, CheckCircle2, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

type AchievementWallProps = {
  completedClassrooms: number;
  perfectQuizScenes: number;
  improvedQuizScenes: number;
};

/**
 * Personal achievement archive derived from persisted study records.
 * Each milestone names the evidence behind it; it never ranks students
 * or awards progress for time spent online.
 */
export function AchievementWall({
  completedClassrooms,
  perfectQuizScenes,
  improvedQuizScenes,
}: AchievementWallProps) {
  const achievements = [
    {
      id: 'classroom-complete',
      title: '完成课件',
      count: completedClassrooms,
      evidence: '课件进度达标，且课件测验均已通过',
    },
    {
      id: 'quiz-perfect',
      title: '测验全对',
      count: perfectQuizScenes,
      evidence: '测验场景中每道题都答对',
    },
    {
      id: 'quiz-improved',
      title: '订正有进步',
      count: improvedQuizScenes,
      evidence: '同一测验场景的后续成绩高于首次成绩',
    },
  ].filter((item) => item.count > 0);

  return (
    <Card className="max-w-6xl mx-auto border-slate-200/80 shadow-sm">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-900">我的成就档案</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          每项成就都对应真实的学习记录，记录你已经做到的事。
        </p>

        {achievements.length > 0 ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {achievements.map((achievement) => (
              <li
                key={achievement.id}
                className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    {achievement.title}
                  </div>
                  <span className="text-xl font-bold tabular-nums text-indigo-700">
                    {achievement.count}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  {achievement.evidence}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
            <p>你的学习记录会在这里变成成就。先从完成一个课件或订正一次测验开始。</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
