import type { LngLat } from '../config/malaysia';

/** One reading from the phone's GPS. */
export type GpsFix = {
  position: LngLat;
  accuracy: number; // metres (68% confidence radius)
  speedKmh: number | null; // null when the device does not report speed
  heading: number | null; // degrees from north, null when standing still / unknown
  timestamp: number; // ms since 1970
};

export type GpsStatus =
  | 'idle' // not started yet (we only ask for permission when the user taps the button)
  | 'requesting' // waiting for the user to answer the permission prompt / first fix
  | 'tracking' // receiving live positions
  | 'denied' // user (or browser settings) blocked location
  | 'unavailable' // GPS is switched off or no signal
  | 'timeout' // no position arrived in time
  | 'unsupported' // this browser has no GPS support
  | 'insecure'; // page is not HTTPS (browsers block GPS on http:// except localhost)

/** Browsers only allow GPS on https:// pages (and http://localhost while developing). */
export function checkGpsSupport(): GpsStatus | null {
  if (!('geolocation' in navigator)) return 'unsupported';
  if (!window.isSecureContext) return 'insecure';
  return null;
}

/** Has the user already allowed location? Lets us start silently without a prompt. */
export async function getPermissionState(): Promise<PermissionState | 'unknown'> {
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state;
  } catch {
    return 'unknown'; // some browsers (older Safari) do not support this query
  }
}

/**
 * Start receiving live GPS positions. Returns a function that stops tracking.
 * The first call shows the browser's "Allow location?" prompt.
 */
export function watchLocation(onFix: (fix: GpsFix) => void, onError: (status: GpsStatus) => void): () => void {
  const id = navigator.geolocation.watchPosition(
    (pos) => {
      const { longitude, latitude, accuracy, speed, heading } = pos.coords;
      onFix({
        position: [longitude, latitude],
        accuracy,
        speedKmh: speed == null || Number.isNaN(speed) ? null : Math.max(0, speed * 3.6),
        heading: heading == null || Number.isNaN(heading) ? null : heading,
        timestamp: pos.timestamp,
      });
    },
    (err) => {
      if (err.code === err.PERMISSION_DENIED) onError('denied');
      else if (err.code === err.TIMEOUT) onError('timeout');
      else onError('unavailable');
    },
    {
      enableHighAccuracy: true, // use real GPS, not just Wi-Fi / cell towers
      maximumAge: 1000, // accept a reading up to 1 s old
      timeout: 20000, // give up waiting for a reading after 20 s
    },
  );
  return () => navigator.geolocation.clearWatch(id);
}

/** Plain-English explanation for each problem, shown to the user. */
export function gpsStatusMessage(status: GpsStatus): string | null {
  switch (status) {
    case 'denied':
      return 'Location is blocked. Allow location for this site in your browser settings, then try again.';
    case 'unavailable':
      return 'Can’t get your location. Check that Location / GPS is switched on.';
    case 'timeout':
      return 'GPS is taking too long. Move to an open area (away from tall buildings) and try again.';
    case 'unsupported':
      return 'This browser doesn’t support location. Try Chrome or Safari.';
    case 'insecure':
      return 'Location only works on a secure (https://) address. Use "npm run dev:phone" or the published site.';
    default:
      return null;
  }
}
