import type { AppLanguage } from '../i18n/arrowStrings';
import { HAZARD_DISCLAIMER, HAZARD_ICON, hazardTitle } from '../i18n/hazardStrings';
import type { RouteHazard } from '../models/hazard';
import { formatClock } from '../utils/format';

/** "2:45 PM", or "23 Feb, 2:45 PM" when not today (Malaysia time). */
export function hazardTime(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  const day = (t: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(t));
  if (day(d.getTime()) === day(now)) return formatClock(d);
  const date = new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', timeZone: 'Asia/Kuala_Lumpur' }).format(d);
  return `${date}, ${formatClock(d)}`;
}

type Props = { hazards: RouteHazard[]; notes: string[]; language: AppLanguage; checkedAt?: number };

/** Full alert list with source + times, notes about missing data, and the safety line. */
export function HazardList({ hazards, notes, language, checkedAt }: Props) {
  return (
    <div className="nn-hazlist">
      <ul>
        {hazards.map((h) => (
          <li key={h.id} className={`nn-hazlist__item is-${h.severity}`}>
            <span className="nn-hazlist__icon" aria-hidden="true">
              {HAZARD_ICON[h.type]}
            </span>
            <span className="nn-hazlist__body">
              <strong>
                {hazardTitle(h, language)}
                {h.demo && <span className="nn-hazlist__demo">DEMO</span>}
              </strong>
              <span>{h.affectedArea}</span>
              <span className="nn-hazlist__meta">
                {h.source} · {hazardTime(h.issuedAt)}
                {h.validUntil && ` – ${hazardTime(h.validUntil)}`}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {notes.map((n) => (
        <p key={n} className="nn-hazlist__note">
          {n}
        </p>
      ))}
      <p className="nn-hazlist__note">
        {HAZARD_DISCLAIMER}
        {checkedAt ? ` (${formatClock(new Date(checkedAt))})` : ''}
      </p>
    </div>
  );
}
