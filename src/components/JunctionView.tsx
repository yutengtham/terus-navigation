import type { Maneuver } from '../models/route';
import type { Lane } from '../services/laneGuidance';

type Props = { lanes: Lane[]; maneuver: Maneuver | null };

/*
 * "Junction view": a small drawing of the road splitting, made from the lane data, shown in
 * the last ~300 m before a junction. Recommended lanes peel off in the maneuver's direction
 * and are green; the others carry on and are grey. It is an illustration, not real lane
 * geometry (Mapbox Standard doesn't provide that), so nothing is drawn on the map itself.
 */
export function JunctionView({ lanes, maneuver }: Props) {
  const mod = maneuver?.modifier ?? '';
  const dir = mod.includes('left') ? -1 : mod.includes('right') ? 1 : 0;
  const w = Math.min(14, 84 / lanes.length); // lane width in px
  const roadWidth = w * lanes.length;
  const x0 = 66 - roadWidth / 2;

  return (
    <div className="nn-card nn-junction" role="img" aria-label="Junction view">
      <svg viewBox="0 0 132 100" width="132" height="100" aria-hidden="true">
        {/* road surface below the split */}
        <rect x={x0 - 3} y="58" width={roadWidth + 6} height="42" rx="3" className="nn-junction__road" />
        {lanes.map((lane, i) => {
          const x = x0 + i * w + w / 2;
          // Recommended lanes bend towards the maneuver; the rest go straight on.
          const bend = lane.recommended && dir !== 0;
          const endX = bend ? x + dir * 34 : x;
          const d = bend ? `M${x} 98 V60 C${x} 40 ${endX} 36 ${endX} 14` : `M${x} 98 V14`;
          return (
            <path
              key={i}
              d={d}
              fill="none"
              strokeWidth={w - 3}
              strokeLinecap="round"
              className={lane.recommended ? 'nn-junction__lane is-recommended' : 'nn-junction__lane'}
            />
          );
        })}
        {/* arrow head on the route */}
        {(() => {
          const rec = lanes.map((l, i) => (l.recommended ? i : -1)).filter((i) => i >= 0);
          const mid = x0 + ((rec[0] + rec[rec.length - 1]) / 2) * w + w / 2 + dir * 34;
          return <polygon points={`${mid},2 ${mid - 8},14 ${mid + 8},14`} className="nn-junction__head" />;
        })()}
      </svg>
    </div>
  );
}
