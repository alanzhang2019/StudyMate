import { Card } from '@/components/ui/card';
import type { DailySlice } from '@/lib/parent/dashboard';

interface Props {
  dailyTrend: DailySlice[];
}

const W = 400;
const H = 160;
const PAD = { top: 12, right: 16, bottom: 26, left: 28 };

export function DailyTrendChart({ dailyTrend }: Props) {
  const maxCount = Math.max(1, ...dailyTrend.map((d) => d.count));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const stepX = dailyTrend.length > 1 ? innerW / (dailyTrend.length - 1) : innerW;

  const points = dailyTrend.map((d, i) => {
    const x = PAD.left + i * stepX;
    const y = PAD.top + innerH - (d.count / maxCount) * innerH;
    return { x, y, ...d };
  });

  // Smooth path through points (line segments are fine for 7 points)
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  // Y-axis ticks at 0, mid, max for context
  const yTicks = [0, Math.round(maxCount / 2), maxCount];

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-slate-700">近 7 天新增</h3>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label="近 7 天新增错题折线图"
        className="mt-3"
      >
        {/* Y-axis tick lines + labels */}
        {yTicks.map((v) => {
          const y = PAD.top + innerH - (v / maxCount) * innerH;
          return (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="2 3"
              />
              <text
                x={PAD.left - 4}
                y={y + 3}
                textAnchor="end"
                style={{ fontSize: 9, fill: '#94a3b8' }}
              >
                {v}
              </text>
            </g>
          );
        })}

        {/* Filled area under the line for visual weight */}
        <path
          d={`${linePath} L ${points[points.length - 1].x} ${PAD.top + innerH} L ${points[0].x} ${PAD.top + innerH} Z`}
          fill="#3b82f6"
          fillOpacity={0.08}
        />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Points + day labels */}
        {points.map((p) => (
          <g key={p.date}>
            <circle cx={p.x} cy={p.y} r={3.5} fill="#3b82f6" stroke="white" strokeWidth={1.5} />
            <text
              x={p.x}
              y={H - 8}
              textAnchor="middle"
              style={{ fontSize: 10, fill: '#64748b' }}
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-1 text-xs text-slate-400">
        共 {dailyTrend.reduce((s, d) => s + d.count, 0)} 道新错题
      </p>
    </Card>
  );
}
