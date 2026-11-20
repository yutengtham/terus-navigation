import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * The phone's compass heading (which way the top of the phone points, 0 = north, clockwise).
 *
 *  - iPhone (Safari): `deviceorientation` events carry `webkitCompassHeading` (already a compass
 *    heading) and `webkitCompassAccuracy` (± degrees). iOS 13+ needs a permission tap first.
 *  - Android (Chrome): `deviceorientationabsolute` events; heading = 360 - alpha.
 *  - Laptops usually have no compass -> status 'unsupported'.
 *
 * Readings are smoothed (averaging the direction as a vector, so 359° and 1° average to 0°).
 */

export type CompassStatus =
  | 'idle'
  | 'needs-permission' // iPhone: must call requestPermission() from a tap
  | 'active'
  | 'denied'
  | 'unsupported'; // no compass events arrived (desktop, or sensors blocked)

export type CompassState = {
  status: CompassStatus;
  /** Smoothed heading in degrees, null until the first reading */
  heading: number | null;
  /** true when the compass looks unreliable -> show the figure-8 calibration hint */
  needsCalibration: boolean;
  /** Must be called from a button tap on iPhone. Safe to call anywhere else. */
  requestPermission: () => Promise<void>;
};

type IOSOrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number };
type OrientationCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

/** iOS reports ± degrees; above this the heading can be badly off. */
const IOS_POOR_ACCURACY_DEG = 30;
/** Android gives no accuracy number, so we treat a very jumpy heading as "needs calibration". */
const JITTER_LIMIT_DEG = 28;
const SMOOTHING = 0.2; // 0..1, lower = smoother but slower to react

/** The screen may be rotated to landscape; the compass is relative to the phone, not the screen. */
function screenAngle(): number {
  return (screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0) as number;
}

export function useCompass(enabled: boolean): CompassState {
  const ctor = (typeof DeviceOrientationEvent !== 'undefined' ? DeviceOrientationEvent : undefined) as
    OrientationCtor | undefined;
  const iosNeedsPermission = typeof ctor?.requestPermission === 'function';
  const [status, setStatus] = useState<CompassStatus>(iosNeedsPermission ? 'needs-permission' : 'idle');
  const [heading, setHeading] = useState<number | null>(null);
  const [needsCalibration, setNeedsCalibration] = useState(false);
  const vec = useRef<{ x: number; y: number } | null>(null);
  const recent = useRef<number[]>([]);
  const [listening, setListening] = useState(false);

  const requestPermission = useCallback(async () => {
    if (!iosNeedsPermission) return;
    try {
      const answer = await ctor!.requestPermission!();
      setStatus(answer === 'granted' ? 'idle' : 'denied');
    } catch {
      setStatus('denied');
    }
  }, [ctor, iosNeedsPermission]);

  useEffect(() => {
    if (!enabled || !ctor || status === 'needs-permission' || status === 'denied') return;
    let gotReading = false;

    const handle = (raw: number, accuracy: number | null) => {
      gotReading = true;
      const h = (raw + screenAngle() + 360) % 360;
      // Vector average for smooth, wrap-safe heading.
      const rad = (h * Math.PI) / 180;
      const v = vec.current ?? { x: Math.sin(rad), y: Math.cos(rad) };
      v.x += (Math.sin(rad) - v.x) * SMOOTHING;
      v.y += (Math.cos(rad) - v.y) * SMOOTHING;
      vec.current = v;
      setHeading(((Math.atan2(v.x, v.y) * 180) / Math.PI + 360) % 360);
      setStatus('active');

      if (accuracy !== null) {
        setNeedsCalibration(accuracy < 0 || accuracy > IOS_POOR_ACCURACY_DEG);
      } else {
        // Android: spread of the last ~2 s of readings while the phone is held still-ish.
        const list = recent.current;
        list.push(h);
        if (list.length > 30) list.shift();
        if (list.length >= 20) {
          const mean = Math.atan2(
            list.reduce((s, d) => s + Math.sin((d * Math.PI) / 180), 0),
            list.reduce((s, d) => s + Math.cos((d * Math.PI) / 180), 0),
          );
          const spread = Math.sqrt(
            list.reduce((s, d) => {
              const diff = ((d - (mean * 180) / Math.PI + 540) % 360) - 180;
              return s + diff * diff;
            }, 0) / list.length,
          );
          setNeedsCalibration(spread > JITTER_LIMIT_DEG);
        }
      }
    };

    const onIOS = (e: Event) => {
      const ev = e as IOSOrientationEvent;
      if (typeof ev.webkitCompassHeading === 'number') handle(ev.webkitCompassHeading, ev.webkitCompassAccuracy ?? null);
    };
    const onAbsolute = (e: Event) => {
      const ev = e as DeviceOrientationEvent;
      if (ev.alpha !== null && ev.absolute !== false) handle(360 - ev.alpha, null);
    };

    window.addEventListener('deviceorientationabsolute', onAbsolute);
    window.addEventListener('deviceorientation', onIOS);
    setListening(true);
    // No reading within 3 s = this device has no usable compass.
    const t = window.setTimeout(() => {
      if (!gotReading) setStatus('unsupported');
    }, 3000);

    return () => {
      window.removeEventListener('deviceorientationabsolute', onAbsolute);
      window.removeEventListener('deviceorientation', onIOS);
      window.clearTimeout(t);
      setListening(false);
    };
    // status is read only to know whether we may listen yet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ctor, status === 'needs-permission' || status === 'denied']);

  return { status: listening || status !== 'idle' ? status : 'idle', heading, needsCalibration, requestPermission };
}
