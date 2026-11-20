import { UpArrowIcon } from './icons';

type Props = {
  durationText: string;
  distanceText: string;
  arrivalText: string;
  onEnd: () => void;
};

/** Bottom floating card: "12 min" / "5.8 km • Arrive 9:53 AM" | blue End Route button. */
export function TripCard({ durationText, distanceText, arrivalText, onEnd }: Props) {
  return (
    <div className="nn-card nn-trip">
      <div className="nn-trip__handle" />
      <div className="nn-trip__row">
        <div className="nn-trip__info">
          <div className="nn-trip__duration">{durationText}</div>
          <div className="nn-trip__meta">
            {distanceText} <span className="nn-dot">•</span> <span className="nn-arrive-label">Arrive </span>
            {arrivalText}
          </div>
        </div>
        <div className="nn-trip__divider" />
        <button className="nn-primary-button" onClick={onEnd}>
          <UpArrowIcon size={24} />
          End Route
        </button>
      </div>
    </div>
  );
}
