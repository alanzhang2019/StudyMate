import { Card } from '@/components/ui/card';
import type { SubjectSlice } from '@/lib/parent/dashboard';

interface Props {
  subjectDistribution: SubjectSlice[];
}

const PALETTE = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#f43f5e', // rose-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
];

const SIZE = 200;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 80;
const R_INNER = 50;

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function arcPath(startAngle: number, endAngle: number): string {
  // Sweep clockwise from startAngle to endAngle (in radians).
  const start = polarToCartesian(CX, CY, R_OUTER, startAngle);
  const end = polarToCartesian(CX, CY, R_OUTER, endAngle);
  const innerStart = polarToCartesian(CX, CY, R_INNER, endAngle);
  const innerEnd = polarToCartesian(CX, CY, R_INNER, startAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${start.x} ${start.y}`,
    `A ${R_OUTER} ${R_OUTER} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${R_INNER} ${R_INNER} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
    'Z',
  ].join(' ');
}

export function SubjectPieChart({ subjectDistribution }: Props) {
  const total = subjectDistribution.reduce((s, x) => s + x.count, 0);

  if (total === 0) {
    return (
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700">学科分布</h3>
        <p className="mt-4 text-sm text-slate-400">
          孩子还没添加错题，这里会显示按学科统计的占比。
        </p>
      </Card>
    );
  }

  let angle = -Math.PI / 2; // 12 o'clock
  const slices = subjectDistribution.map((s, i) => {
    const fraction = s.count / total;
    const next = angle + fraction * Math.PI * 2;
    const path = arcPath(angle, next);
    angle = next;
    return { ...s, path, color: PALETTE[i % PALETTE.length] };
  });

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-slate-700">学科分布</h3>
      <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={160}
          height={160}
          aria-label="学科错题占比"
        >
          {slices.map((s) => (
            <path
              key={s.subject}
              d={s.path}
              fill={s.color}
              stroke="white"
              strokeWidth={1.5}
            >
              <title>
                {s.subject}：{s.count} 道
              </title>
            </path>
          ))}
          <text
            x={CX}
            y={CY - 4}
            textAnchor="middle"
            className="fill-slate-800"
            style={{ fontSize: 22, fontWeight: 700 }}
          >
            {total}
          </text>
          <text
            x={CX}
            y={CY + 14}
            textAnchor="middle"
            className="fill-slate-400"
            style={{ fontSize: 10 }}
          >
            总题数
          </text>
        </svg>
        <ul className="space-y-1.5 text-sm">
          {slices.map((s) => (
            <li key={s.subject} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              <span className="text-slate-700">{s.subject}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500">
                {s.count} 道（{Math.round((s.count / total) * 100)}%）
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
