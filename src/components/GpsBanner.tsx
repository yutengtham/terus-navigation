import type { GpsStatus } from '../services/locationService';
import { gpsStatusMessage } from '../services/locationService';

type Props = {
  status: GpsStatus;
  stale: boolean;
  accuracy: number | null;
  onRetry: () => void;
  onDismiss: () => void;
};

/** Small card under the search bar explaining GPS problems in plain English. */
export function GpsBanner({ status, stale, accuracy, onRetry, onDismiss }: Props) {
  let message = gpsStatusMessage(status);
  let canRetry = status !== 'unsupported' && status !== 'insecure';
  if (!message && status === 'requesting') {
    message = 'Finding your location…';
    canRetry = false;
  }
  if (!message && status === 'tracking' && stale) {
    message = 'GPS signal lost (tunnel, basement or indoor car park?). Showing your last known position.';
    canRetry = false;
  }
  if (!message && status === 'tracking' && accuracy != null && accuracy > 100) {
    message = `Weak GPS signal (±${Math.round(accuracy)} m). Your position may be off.`;
    canRetry = false;
  }
  if (!message) return null;

  return (
    <div className="nn-card nn-banner" role="status">
      <span>{message}</span>
      <div className="nn-banner__actions">
        {canRetry && (
          <button className="nn-link-button" onClick={onRetry}>
            Try again
          </button>
        )}
        <button className="nn-link-button nn-link-button--muted" onClick={onDismiss}>
          OK
        </button>
      </div>
    </div>
  );
}
