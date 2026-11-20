import type { ComfortPreference } from '../services/comfortService';
import { formatClock } from '../utils/format';
import { SunIcon, UmbrellaIcon } from './icons';

type Props = {
  preference: ComfortPreference;
  onChangePreference: (p: ComfortPreference) => void;
  /** null = leave now */
  departure: number | null;
  onChangeDeparture: (time: number | null) => void;
};

/** The next 12 full hours, so you can check shade for later today ("leave at 4 PM"). */
function departureChoices(): number[] {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  return Array.from({ length: 12 }, (_, i) => start.getTime() + (i + 1) * 3600_000);
}

const PREFS: { value: ComfortPreference; label: string; Icon?: typeof SunIcon }[] = [
  { value: 'fastest', label: 'Fastest' },
  { value: 'shade', label: 'Shaded', Icon: SunIcon },
  { value: 'shelter', label: 'Sheltered', Icon: UmbrellaIcon },
];

/** Walking / cycling only: "Shaded" for sunny days, "Sheltered" for rainy days (like Undercover). */
export function ComfortBar({ preference, onChangePreference, departure, onChangeDeparture }: Props) {
  return (
    <div className="nn-comfort">
      <div className="nn-comfort__prefs" role="radiogroup" aria-label="Route preference">
        {PREFS.map(({ value, label, Icon }) => (
          <button
            key={value}
            role="radio"
            aria-checked={value === preference}
            className={`nn-comfort__pref${value === preference ? ' is-active' : ''}`}
            onClick={() => onChangePreference(value)}
          >
            {Icon && <Icon size={15} />}
            {label}
          </button>
        ))}
      </div>
      <select
        className="nn-comfort__time"
        aria-label="Leaving time (used for shade)"
        value={departure ?? 'now'}
        onChange={(e) => onChangeDeparture(e.target.value === 'now' ? null : Number(e.target.value))}
      >
        <option value="now">Leave now</option>
        {departureChoices().map((t) => (
          <option key={t} value={t}>
            Leave {formatClock(new Date(t))}
          </option>
        ))}
      </select>
    </div>
  );
}
