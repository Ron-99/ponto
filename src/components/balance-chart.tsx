import { type BalancePoint, balanceChart } from "@/lib/hours";

/** Linha do saldo acumulado em SVG, sem JavaScript no cliente. */
export function BalanceChart({ points, label }: { points: BalancePoint[]; label: string | null }) {
  const chart = balanceChart(points);
  if (chart.kind === "empty") {
    return <p className="text-sm text-muted-foreground">{chart.message}</p>;
  }
  const { width, height, zeroY, segments, labels } = chart;
  const last = segments.at(-1)?.points.at(-1) ?? [width, zeroY];
  return (
    <figure className="grid gap-1">
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{labels.top}</span>
      </div>
      <svg
        role="img"
        aria-label={label ?? undefined}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-32 w-full overflow-visible"
      >
        <line
          x1={0}
          x2={width}
          y1={zeroY}
          y2={zeroY}
          stroke="currentColor"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          className="text-border"
        />
        {segments.map((s) => (
          <path
            key={`${s.points[0][0]}-${s.tone}`}
            d={`M${s.points.map(([x, y]) => `${x},${y}`).join("L")}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className={s.tone}
          />
        ))}
        {/* Ponto de hoje: traço de comprimento zero com ponta redonda, para não deformar. */}
        <path
          d={`M${last[0]},${last[1]}h0`}
          stroke="currentColor"
          strokeWidth={8}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className={segments.at(-1)?.tone}
        />
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{labels.bottom}</span>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{labels.start}</span>
        <span>{labels.end}</span>
      </div>
    </figure>
  );
}
