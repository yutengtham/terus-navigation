import { HAZARD_ICON, HAZARD_LABEL } from '../i18n/hazardStrings';
import type { RouteHazard } from '../models/hazard';
import { formatDistance } from '../utils/format';

type Props = {
  hazard: RouteHazard;
  /** metres to the start of the stretch; 0 = already in it */
  distance: number;
  /** Only when stopped (< 5 km/h): tap opens details. Moving: read-only. */
  canOpen: boolean;
  onOpen: () => void;
};

/** Navigation: compact "🌊 Flood alert in 5.0 km" under the instruction card. */
export function HazardPill({ hazard, distance, canOpen, onOpen }: Props) {
  const red = hazard.severity === 'danger' || (hazard.type === 'flood' && hazard.severity === 'warning');
  const text = `${HAZARD_LABEL[hazard.type]} ${distance <= 0 ? 'here' : `in ${formatDistance(distance)}`}`;
  return (
    <button
      className={`nn-hazpill${red ? ' is-red' : ''}${canOpen ? ' is-tappable' : ''}`}
      onClick={canOpen ? onOpen : undefined}
      aria-disabled={!canOpen}
      aria-label={canOpen ? `${text}. Tap for details.` : `${text}. Details available when stopped.`}
      role="status"
    >
      <span aria-hidden="true">{HAZARD_ICON[hazard.type]}</span>
      {text}
      {hazard.demo && <span className="nn-hazpill__demo">DEMO</span>}
    </button>
  );
}
