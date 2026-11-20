import type { AppLanguage } from '../i18n/arrowStrings';
import type { RouteHazard } from '../models/hazard';
import { HazardList } from './HazardList';

type Props = { hazards: RouteHazard[]; notes: string[]; language: AppLanguage; checkedAt: number; onClose: () => void };

/** Navigation: alert details (opened from the hazard pill while stopped). */
export function HazardSheet({ hazards, notes, language, checkedAt, onClose }: Props) {
  return (
    <div className="nn-hazsheet" role="dialog" aria-label="Alerts on your route" onClick={onClose}>
      <div className="nn-card nn-hazsheet__card" onClick={(e) => e.stopPropagation()}>
        <div className="nn-hazsheet__head">
          <strong>Alerts on your route</strong>
          <button className="nn-link-button" onClick={onClose}>
            Close
          </button>
        </div>
        <HazardList hazards={hazards} notes={notes} language={language} checkedAt={checkedAt} />
      </div>
    </div>
  );
}
