import type { Lane, LaneIndication } from '../services/laneGuidance';

/*
 * Lane arrows (left to right) shown inside the instruction card before a junction.
 * Recommended lanes are full colour; the others are grey and faded. Each lane shows all of
 * its painted arrows; in a recommended lane the arrow the route follows is drawn strongest.
 */

type Shape = { d: string; tip: [number, number]; angle: number };

/** Arrow shapes for right-hand indications on a 24x32 grid (left ones are mirrored). */
const RIGHT_SHAPES: Record<'straight' | 'slight' | 'turn' | 'sharp' | 'uturn', Shape> = {
  straight: { d: 'M12 30 V9', tip: [12, 4], angle: -90 },
  slight: { d: 'M12 30 V19 Q12 14 16.5 9.5', tip: [19.5, 6.5], angle: -45 },
  turn: { d: 'M12 30 V17 Q12 11.5 17.5 11.5', tip: [22.5, 11.5], angle: 0 },
  sharp: { d: 'M12 30 V12 Q12 8.5 15 11.5 L17 14', tip: [20, 17.5], angle: 50 },
  // Malaysia drives on the left, so a U-turn swings round to the right.
  uturn: { d: 'M8 30 V11 Q8 5 13.5 5 Q19 5 19 11 V16', tip: [19, 21], angle: 90 },
};

function shapeFor(ind: LaneIndication): { shape: Shape; mirrored: boolean } {
  const mirrored = ind.includes('left');
  if (ind === 'uturn') return { shape: RIGHT_SHAPES.uturn, mirrored: false };
  if (ind.startsWith('slight')) return { shape: RIGHT_SHAPES.slight, mirrored };
  if (ind.startsWith('sharp')) return { shape: RIGHT_SHAPES.sharp, mirrored };
  if (ind === 'straight') return { shape: RIGHT_SHAPES.straight, mirrored: false };
  return { shape: RIGHT_SHAPES.turn, mirrored };
}

/** Small triangle arrow head pointing along `angle` (degrees, 0 = right) with its tip at `tip`. */
function head([x, y]: [number, number], angle: number): string {
  const a = (angle * Math.PI) / 180;
  const back = 6.5;
  const half = 4.2;
  const bx = x - Math.cos(a) * back;
  const by = y - Math.sin(a) * back;
  const px = -Math.sin(a) * half;
  const py = Math.cos(a) * half;
  return `${x},${y} ${bx + px},${by + py} ${bx - px},${by - py}`;
}

function LaneArrow({ lane }: { lane: Lane }) {
  // Draw the followed arrow last so it sits on top.
  const order = [...lane.indications].sort((a, b) => Number(a === lane.preferredIndication) - Number(b === lane.preferredIndication));
  return (
    <svg className="nn-lane__svg" viewBox="0 0 24 32" aria-hidden="true">
      {order.map((ind) => {
        const { shape, mirrored } = shapeFor(ind);
        const faint = lane.recommended && lane.preferredIndication && ind !== lane.preferredIndication;
        return (
          <g key={ind} transform={mirrored ? 'translate(24 0) scale(-1 1)' : undefined} opacity={faint ? 0.4 : 1}>
            <path d={shape.d} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <polygon points={head(shape.tip, shape.angle)} fill="currentColor" />
          </g>
        );
      })}
    </svg>
  );
}

/** Spoken-style summary for screen readers, e.g. "Lanes: 2 of 4 recommended". */
function label(lanes: Lane[]): string {
  return `Lanes: ${lanes.filter((l) => l.recommended).length} of ${lanes.length} recommended`;
}

export function LaneRow({ lanes }: { lanes: Lane[] }) {
  return (
    <div className="nn-lanes" role="img" aria-label={label(lanes)}>
      {lanes.map((lane, i) => (
        <div key={i} className={`nn-lane${lane.recommended ? ' is-recommended' : ''}`}>
          <LaneArrow lane={lane} />
        </div>
      ))}
    </div>
  );
}
