import { getDisplayUnits } from '../utils/format';

type Props = { speedKmh: number; maxKmh?: number };

/** Round speed badge with a green progress arc (current GPS speed). */
export function SpeedGauge({ speedKmh, maxKmh = 120 }: Props) {
  const imperial = getDisplayUnits() === 'imperial';
  const shown = imperial ? speedKmh * 0.621371 : speedKmh;
  const unit = imperial ? 'mph' : 'km/h';
  const r = 44;
  const circumference = 2 * Math.PI * r;
  const arc = circumference * 0.75; // gauge uses 3/4 of the circle
  const filled = arc * Math.min(1, Math.max(0, speedKmh / maxKmh));

  return (
    <div className="nn-speed" aria-label={`Speed ${Math.round(shown)} ${imperial ? 'miles' : 'kilometres'} per hour`}>
      <svg viewBox="0 0 100 100" className="nn-speed__ring">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#E6ECF3" strokeWidth="5"
          strokeDasharray={`${arc} ${circumference}`} strokeLinecap="round" transform="rotate(135 50 50)" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="#22D3A5" strokeWidth="5"
          strokeDasharray={`${filled} ${circumference}`} strokeLinecap="round" transform="rotate(135 50 50)"
          style={{ transition: 'stroke-dasharray 0.3s ease' }} />
      </svg>
      <div className="nn-speed__value">{Math.round(shown)}</div>
      <div className="nn-speed__unit">{unit}</div>
    </div>
  );
}
