import { useState } from 'react';
import type { AppLanguage } from '../i18n/arrowStrings';
import { HAZARD_ICON } from '../i18n/hazardStrings';
import type { RouteHazard } from '../models/hazard';
import { HazardList } from './HazardList';

const SHORT: Record<RouteHazard['type'], string> = {
  flood: 'FLOOD ALERT',
  heavy_rain: 'HEAVY RAIN',
  thunderstorm: 'THUNDERSTORM',
  wind: 'STRONG WIND',
  other: 'WEATHER ALERT',
};

/** One short label: "🌊 FLOOD ALERT". Details (place, source, times) are in the expanded list. */
export function hazardSummary(h: RouteHazard): string {
  return `${HAZARD_ICON[h.type]} ${SHORT[h.type]}`;
}

type Props = { hazards: RouteHazard[]; notes: string[]; language: AppLanguage; checkedAt: number };

/** Route preview: the most important alert in one line; tap to see all of them with sources. */
export function HazardBanner({ hazards, notes, language, checkedAt }: Props) {
  const [open, setOpen] = useState(false);
  const top = [...hazards].sort((a, b) => rank(b) - rank(a))[0];
  if (!top) return null;
  return (
    <div className={`nn-hazbanner is-${top.severity}${top.type === 'flood' ? ' is-flood' : ''}`}>
      <button className="nn-hazbanner__head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="nn-hazbanner__text">
          {hazardSummary(top)}
          {top.demo && <span className="nn-hazlist__demo">DEMO</span>}
        </span>
        <span className="nn-hazbanner__more">{hazards.length > 1 ? `+${hazards.length - 1}  ` : ''}{open ? '▴' : '▾'}</span>
      </button>
      {open && <HazardList hazards={hazards} notes={notes} language={language} checkedAt={checkedAt} />}
    </div>
  );
}

function rank(h: RouteHazard): number {
  return (h.type === 'flood' ? 10 : 0) + (h.severity === 'danger' ? 2 : h.severity === 'warning' ? 1 : 0);
}
