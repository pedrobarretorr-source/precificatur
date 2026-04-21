import { useMemo, useState } from 'react';
import { formatBRL, formatPercent } from '@/lib/pricing-engine';
import { cn } from '@/lib/utils';

interface ChartPoint {
  pax: number;
  profit: number;
  margin: number;
}

interface ProfitCurveChartProps {
  points: ChartPoint[];
  breakEvenPax: number | null;
  simulatedPax: number;
}

const W = 400;
const H = 200;
const PAD = { top: 16, right: 14, bottom: 28, left: 48 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

function niceAbs(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toFixed(abs >= 10000 ? 0 : 1).replace('.', ',')}k`;
  return v.toFixed(0);
}

export function ProfitCurveChart({ points, breakEvenPax, simulatedPax }: ProfitCurveChartProps) {
  const [hoverPax, setHoverPax] = useState<number | null>(null);

  const { xScale, yScale, zeroY, pathLine, pathArea, yTicks, minPax, maxPax } = useMemo(() => {
    if (points.length === 0) {
      return {
        xScale: (_p: number) => 0,
        yScale: (_v: number) => 0,
        zeroY: H - PAD.bottom,
        pathLine: '',
        pathArea: '',
        yTicks: [] as { y: number; label: string }[],
        minPax: 1,
        maxPax: 1,
      };
    }
    const minP = points[0].pax;
    const maxP = points[points.length - 1].pax;
    const profits = points.map(p => p.profit);
    const rawMin = Math.min(0, ...profits);
    const rawMax = Math.max(0, ...profits);
    const range = rawMax - rawMin || 1;
    const padY = range * 0.1;
    const yMin = rawMin - padY;
    const yMax = rawMax + padY;

    const xS = (p: number) =>
      PAD.left + (maxP === minP ? 0 : ((p - minP) / (maxP - minP)) * INNER_W);
    const yS = (v: number) =>
      PAD.top + (1 - (v - yMin) / (yMax - yMin)) * INNER_H;
    const zY = yS(0);

    const coords = points.map(p => `${xS(p.pax)},${yS(p.profit)}`);
    const line = `M ${coords.join(' L ')}`;
    const area = `M ${xS(points[0].pax)},${zY} L ${coords.join(' L ')} L ${xS(points[points.length - 1].pax)},${zY} Z`;

    // 4 y-ticks
    const ticks: { y: number; label: string }[] = [];
    for (let i = 0; i <= 3; i++) {
      const v = yMin + (i / 3) * (yMax - yMin);
      ticks.push({ y: yS(v), label: `R$ ${niceAbs(v)}` });
    }

    return { xScale: xS, yScale: yS, zeroY: zY, pathLine: line, pathArea: area, yTicks: ticks, minPax: minP, maxPax: maxP };
  }, [points]);

  const hoverPoint = hoverPax !== null ? points.find(p => p.pax === hoverPax) : null;

  function handleMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const relX = (x - PAD.left) / INNER_W;
    const pax = Math.round(minPax + relX * (maxPax - minPax));
    const clamped = Math.max(minPax, Math.min(maxPax, pax));
    setHoverPax(clamped);
  }

  if (points.length === 0) return null;

  const xTicks: number[] = [];
  const step = Math.max(1, Math.floor((maxPax - minPax) / 5));
  for (let p = minPax; p <= maxPax; p += step) xTicks.push(p);
  if (xTicks[xTicks.length - 1] !== maxPax) xTicks.push(maxPax);

  return (
    <div className="relative rounded-xl border border-surface-200 bg-white p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
        <defs>
          <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="lossGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(239 68 68)" stopOpacity="0.02" />
            <stop offset="100%" stopColor="rgb(239 68 68)" stopOpacity="0.4" />
          </linearGradient>
          <clipPath id="above-zero">
            <rect x="0" y="0" width={W} height={zeroY} />
          </clipPath>
          <clipPath id="below-zero">
            <rect x="0" y={zeroY} width={W} height={H - zeroY} />
          </clipPath>
        </defs>

        {/* Y grid */}
        {yTicks.map((t, i) => (
          <g key={`yt-${i}`}>
            <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y} stroke="rgb(226 232 240)" strokeWidth="1" />
            <text x={PAD.left - 6} y={t.y + 3} textAnchor="end" fontSize="9" fill="rgb(148 163 184)" fontWeight="600">
              {t.label}
            </text>
          </g>
        ))}

        {/* Zero line (bold dashed) */}
        <line x1={PAD.left} y1={zeroY} x2={W - PAD.right} y2={zeroY} stroke="rgb(100 116 139)" strokeWidth="1.2" strokeDasharray="4 3" />

        {/* Area above zero (emerald) */}
        <path d={pathArea} fill="url(#profitGrad)" clipPath="url(#above-zero)" />
        {/* Area below zero (red) */}
        <path d={pathArea} fill="url(#lossGrad)" clipPath="url(#below-zero)" />

        {/* Line */}
        <path d={pathLine} fill="none" stroke="rgb(30 58 95)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* X ticks */}
        {xTicks.map(p => (
          <text
            key={`xt-${p}`}
            x={xScale(p)}
            y={H - PAD.bottom + 16}
            textAnchor="middle"
            fontSize="9"
            fontWeight="600"
            fill="rgb(148 163 184)"
          >
            {p}
          </text>
        ))}
        <text x={PAD.left + INNER_W / 2} y={H - 3} textAnchor="middle" fontSize="9" fill="rgb(100 116 139)" fontWeight="700">
          passageiros
        </text>

        {/* Vertical reference lines */}
        {breakEvenPax !== null && breakEvenPax >= minPax && breakEvenPax <= maxPax && (
          <line
            x1={xScale(breakEvenPax)} y1={PAD.top}
            x2={xScale(breakEvenPax)} y2={H - PAD.bottom}
            stroke="rgb(16 185 129)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.75"
          />
        )}
        {points.some(p => p.pax === simulatedPax) && (
          <line
            x1={xScale(simulatedPax)} y1={PAD.top}
            x2={xScale(simulatedPax)} y2={H - PAD.bottom}
            stroke="rgb(249 115 22)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.75"
          />
        )}

        {/* Break-even marker */}
        {breakEvenPax !== null && breakEvenPax >= minPax && breakEvenPax <= maxPax && (
          <g>
            <circle cx={xScale(breakEvenPax)} cy={zeroY} r="7" fill="rgb(16 185 129)" opacity="0.25">
              <animate attributeName="r" values="5;11;5" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.35;0;0.35" dur="1.8s" repeatCount="indefinite" />
            </circle>
            <circle cx={xScale(breakEvenPax)} cy={zeroY} r="4" fill="rgb(16 185 129)" stroke="white" strokeWidth="1.5" />
          </g>
        )}

        {/* Simulation marker */}
        {(() => {
          const sp = points.find(p => p.pax === simulatedPax);
          if (!sp) return null;
          return (
            <g>
              <circle cx={xScale(sp.pax)} cy={yScale(sp.profit)} r="6" fill="rgb(249 115 22)" stroke="white" strokeWidth="2" />
            </g>
          );
        })()}

        {/* Hover marker */}
        {hoverPoint && (
          <g>
            <line
              x1={xScale(hoverPoint.pax)}
              y1={PAD.top}
              x2={xScale(hoverPoint.pax)}
              y2={H - PAD.bottom}
              stroke="rgb(148 163 184)"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <circle cx={xScale(hoverPoint.pax)} cy={yScale(hoverPoint.profit)} r="4" fill="white" stroke="rgb(30 58 95)" strokeWidth="2" />
          </g>
        )}

        {/* Invisible hover capture */}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={INNER_W}
          height={INNER_H}
          fill="transparent"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverPax(null)}
        />
      </svg>

      {/* Tooltip */}
      {hoverPoint && (
        <div
          className={cn(
            'absolute top-1 right-3 rounded-lg bg-brand-navy text-white px-3 py-2 text-xs font-semibold shadow-lg pointer-events-none',
            'flex items-center gap-3',
          )}
        >
          <span className="font-bold">{hoverPoint.pax} pax</span>
          <span className={hoverPoint.profit >= 0 ? 'text-emerald-300' : 'text-red-300'}>
            {hoverPoint.profit >= 0 ? '+' : ''}{formatBRL(hoverPoint.profit)}
          </span>
          <span className="text-surface-300">{formatPercent(hoverPoint.margin)}</span>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-[10px] text-surface-500">
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Ponto de equilíbrio
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-brand-orange" />
          Sua simulação
        </span>
      </div>
    </div>
  );
}
