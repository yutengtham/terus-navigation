import { useRef } from 'react';
import type { Maneuver } from '../models/route';
import type { Lane } from '../services/laneGuidance';
import { maneuverIcon, maneuverTitle } from '../services/maneuverText';
import { CloseIcon } from './icons';
import { LaneRow } from './LaneRow';
import { ManeuverIcon } from './ManeuverIcon';

type Props = {
  maneuver: Maneuver | null;
  distanceText: string;
  onClose: () => void;
  /** Lane guidance for the upcoming junction; null hides the lane row (with a slide animation). */
  lanes?: Lane[] | null;
};

/** Top floating card: turn arrow | "Turn right" / "in 300 m" | close button. */
export function InstructionCard({ maneuver, distanceText, onClose, lanes = null }: Props) {
  const icon = maneuverIcon(maneuver);
  const isArrive = maneuver?.type === 'arrive';
  // Keep the last lanes while the row slides closed, so it doesn't go blank mid-animation.
  const lastLanes = useRef<Lane[] | null>(null);
  if (lanes) lastLanes.current = lanes;
  const shown = lanes ?? lastLanes.current;

  return (
    <div className="nn-card nn-instruction" role="status" aria-live="polite">
      <div className="nn-instruction__icon">
        <ManeuverIcon kind={icon.kind} mirrored={icon.mirrored} />
      </div>
      <div className="nn-instruction__divider" />
      <div className="nn-instruction__text">
        <div className="nn-instruction__title">{maneuverTitle(maneuver)}</div>
        <div className="nn-instruction__sub">{isArrive ? distanceText : `in ${distanceText}`}</div>
      </div>
      <button className="nn-instruction__close" onClick={onClose} aria-label="End navigation">
        <CloseIcon />
      </button>
      {shown && (
        <div className={`nn-instruction__lanes${lanes ? ' is-open' : ''}`} aria-hidden={!lanes}>
          <div className="nn-instruction__lanes-inner">
            <LaneRow lanes={shown} />
          </div>
        </div>
      )}
    </div>
  );
}
