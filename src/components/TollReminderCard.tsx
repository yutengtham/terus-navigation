import type { TollCardStrings } from '../i18n/navStrings';
import { shortPlazaName, type UpcomingToll } from '../services/tollAhead';
import { formatRM } from '../services/tollEstimate';
import { formatDistance } from '../utils/format';

type Props = {
  next: UpcomingToll;
  after: UpcomingToll | null;
  /** Within 1 km: highlighted (amber) */
  near: boolean;
  t: TollCardStrings;
};

/** Toll booth icon (barrier + booth), drawn for Terus. */
function TollIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="8" height="16" rx="1.5" />
      <path d="M5.5 8h3M11 12h10" />
      <path d="M14 10.5v3M17.5 10.5v3" />
      <path d="M3 20h8" />
    </svg>
  );
}

/** Bottom-right card: "Toll · 3.6 km · Pantai · RM2.50" and the one after ("Next: 16.2 km"). */
export function TollReminderCard({ next, after, near, t }: Props) {
  return (
    <div className={`nn-card nn-tollcard${near ? ' is-near' : ''}`} role="status" aria-live="polite">
      <div className="nn-tollcard__top">
        <TollIcon />
        <span className="nn-tollcard__label">{t.label}</span>
      </div>
      <div className="nn-tollcard__distance">{formatDistance(next.distance)}</div>
      <div className="nn-tollcard__name">{shortPlazaName(next.name) || '—'}</div>
      <div className="nn-tollcard__price">{next.rate ? formatRM(next.rate.rm) : t.notPriced}</div>
      {after && (
        <div className="nn-tollcard__after">
          {t.next}: {formatDistance(after.distance)}
        </div>
      )}
    </div>
  );
}
