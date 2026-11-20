import { useCallback, useEffect, useRef, useState } from 'react';
import { checkGpsSupport, getPermissionState, watchLocation, type GpsFix, type GpsStatus } from '../services/locationService';

/** A reading older than this means the GPS signal was lost (tunnel, basement, multi-level car park). */
const STALE_AFTER_MS = 15000;

export type GeolocationState = {
  status: GpsStatus;
  fix: GpsFix | null;
  /** true when we had a position but no new reading for a while */
  stale: boolean;
  /** Ask for permission (if needed) and start live tracking. */
  start: () => void;
  stop: () => void;
};

export function useGeolocation(): GeolocationState {
  const [status, setStatus] = useState<GpsStatus>('idle');
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [stale, setStale] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
  }, []);

  const start = useCallback(() => {
    const problem = checkGpsSupport();
    if (problem) {
      setStatus(problem);
      return;
    }
    stop();
    setStatus((s) => (s === 'tracking' ? s : 'requesting'));
    stopRef.current = watchLocation(
      (f) => {
        setFix(f);
        setStale(false);
        setStatus('tracking');
      },
      (err) => {
        setStatus(err);
        // Permission denied is final until the user changes browser settings.
        if (err === 'denied') stop();
      },
    );
  }, [stop]);

  // If the user already allowed location on an earlier visit, start quietly (no prompt).
  useEffect(() => {
    if (checkGpsSupport()) return;
    getPermissionState().then((state) => {
      if (state === 'granted') start();
    });
    return stop;
  }, [start, stop]);

  // Detect signal loss.
  useEffect(() => {
    if (!fix) return;
    const t = window.setTimeout(() => setStale(true), STALE_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [fix]);

  return { status, fix, stale, start, stop };
}
