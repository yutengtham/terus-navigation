import type { LngLat } from '../config/malaysia';
import type { Place } from '../models/place';
import { formatDistance } from '../utils/format';
import { distanceMeters } from '../utils/geo';
import { CloseIcon, UpArrowIcon } from './icons';

type Props = {
  place: Place;
  userPosition: LngLat | null;
  onClose: () => void;
  onDirections: () => void;
};

/** Destination details shown after picking a search result. */
export function DestinationCard({ place, userPosition, onClose, onDirections }: Props) {
  // Straight-line distance only - real driving distance comes from the route in Phase 7.
  const straight = userPosition ? formatDistance(distanceMeters(userPosition, place.coordinates)) : null;

  return (
    <div className="nn-card nn-trip nn-home-card nn-dest-card">
      <div className="nn-trip__handle" />
      <div className="nn-dest-card__top">
        <div className="nn-trip__info">
          <div className="nn-home-card__title">{place.name}</div>
          <div className="nn-dest-card__address">{place.address}</div>
          <div className="nn-dest-card__meta">
            {[place.category, straight && `${straight} away (straight line)`].filter(Boolean).join(' · ') ||
              'Turn on location to see how far it is'}
          </div>
        </div>
        <button className="nn-icon-button nn-dest-card__close" onClick={onClose} aria-label="Close destination">
          <CloseIcon />
        </button>
      </div>
      <button className="nn-primary-button nn-dest-card__go" onClick={onDirections}>
        <UpArrowIcon size={22} />
        Directions
      </button>
    </div>
  );
}
