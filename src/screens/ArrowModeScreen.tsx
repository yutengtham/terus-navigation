import { useEffect, useMemo, useRef, useState } from 'react';
import { BigArrow } from '../components/BigArrow';
import { BackIcon, PinIcon, SpeakerIcon } from '../components/icons';
import type { LngLat } from '../config/malaysia';
import { useArrowDemo } from '../hooks/useArrowDemo';
import { useCompass } from '../hooks/useCompass';
import type { GeolocationState } from '../hooks/useGeolocation';
import { useWakeLock } from '../hooks/useWakeLock';
import { ARROW_STRINGS, SPEECH_LANG, type AppLanguage, type ArrowStrings } from '../i18n/arrowStrings';
import type { Maneuver, TravelMode, TripPoint } from '../models/route';
import {
  arrivalRadius,
  arrowAngle,
  arrowTarget,
  arrowTone,
  cueForAngle,
  isOffRoute,
  secondsLeft,
  type VoiceCue,
} from '../services/arrowGuidance';
import { fetchRoutes, type RouteOptions } from '../services/directionsService';
import { prepareRoute, type PreparedRoute } from '../services/routeProgress';
import { speak, unlockVoice } from '../services/voiceService';
import { formatDistance, formatDuration, getDisplayUnits } from '../utils/format';
import { distanceMeters, measureLine, type MeasuredLine } from '../utils/geo';

type Props = {
  token: string;
  destination: TripPoint;
  gps: GeolocationState;
  language: AppLanguage;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  /** Car / walk / cycle - which kind of route to follow (last choice on the route screen) */
  travelMode: TravelMode;
  routeOptions: Pick<RouteOptions, 'avoidTolls' | 'avoidHighways' | 'avoidFerries' | 'units'>;
  /** Simulated walk along the route for presenting indoors */
  demo: boolean;
  /** Back / Show Map: return to the map with this destination still selected */
  onShowMap: () => void;
  /** End / Done: leave Arrow Mode and clear the destination */
  onEnd: () => void;
};

/** Above this speed the screen switches to the simplified driving view. */
const DRIVING_KMH = 15;
/** GPS readings less precise than this are treated as "searching for signal". */
const WEAK_GPS_M = 50;
/** Don't ask for a new route more often than this. */
const REROUTE_GAP_MS = 15000;
/** A voice cue must hold this long before it is spoken (ignores quick wobbles)... */
const CUE_HOLD_MS = 1200;
/** ...and cues are at least this far apart. */
const CUE_GAP_MS = 4500;

/** "658 m" (exact below 1 km, as the spec asks) or "1.4 km"; imperial uses the app's formatter. */
function arrowDistance(m: number): string {
  if (getDisplayUnits() === 'imperial') return formatDistance(m);
  if (m < 1000) return `${Math.max(0, Math.round(m))} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

/** Short turn name for the driving view, in the chosen language. */
function turnLabel(m: Maneuver | null, t: ArrowStrings): string {
  if (!m) return t.continueStraight;
  const mod = m.modifier ?? '';
  if (m.type === 'arrive') return t.youHaveArrived;
  if (mod === 'uturn') return t.uTurn;
  if (mod.startsWith('slight') || m.type === 'fork') return mod.includes('left') ? t.slightLeft : t.slightRight;
  if (mod.includes('left')) return t.turnLeftShort;
  if (mod.includes('right')) return t.turnRightShort;
  return t.continueStraight;
}

/** Demo start: a point ~450 m (walking) or ~1.5 km (driving) south-west of the destination. */
function demoStart(dest: LngLat, mode: TravelMode): LngLat {
  const meters = mode === 'driving' ? 1500 : mode === 'cycling' ? 900 : 450;
  const d = meters / Math.SQRT2;
  return [dest[0] - d / (111320 * Math.cos((dest[1] * Math.PI) / 180)), dest[1] - d / 110574];
}

type RouteStatus = 'loading' | 'ok' | 'none' | 'offline';

/**
 * Arrow Mode: one big arrow pointing the way, the distance left, and almost nothing else.
 * Made for the "last mile" (finding the building, R&R entrance, car park or shop) and for
 * anyone who finds a busy map hard to follow.
 */
export function ArrowModeScreen({
  token,
  destination,
  gps,
  language,
  voiceEnabled,
  onToggleVoice,
  travelMode,
  routeOptions,
  demo,
  onShowMap,
  onEnd,
}: Props) {
  const t = ARROW_STRINGS[language];
  const [paused, setPaused] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [route, setRoute] = useState<PreparedRoute | null>(null);
  const [routeStatus, setRouteStatus] = useState<RouteStatus>('loading');
  const [rerouting, setRerouting] = useState(false);
  const [permAsked, setPermAsked] = useState(false);
  const stoppedGps = useRef(false);

  useWakeLock(!arrived); // keep the screen on while Arrow Mode is open

  // ---------- where am I, which way am I facing? ----------
  const compass = useCompass(!demo && !paused && !arrived);
  const [demoLine, setDemoLine] = useState<MeasuredLine | null>(null);
  const demoState = useArrowDemo(demoLine, demo && !arrived, travelMode, paused);
  const fix = demo ? demoState.fix : gps.fix;
  const speedKmh = fix?.speedKmh ?? 0;
  const driving = speedKmh > DRIVING_KMH;

  // No compass (most laptops): use the GPS direction of travel while moving.
  const heading = demo ? demoState.heading : (compass.heading ?? (fix?.heading != null && speedKmh > 3 ? fix.heading : null));

  const gpsWeak = !demo && (!fix || gps.stale || gps.status !== 'tracking' || fix.accuracy > WEAK_GPS_M);

  // ---------- permissions ----------
  const needsPermission =
    !demo && !permAsked && (gps.status === 'idle' || gps.status === 'denied' || compass.status === 'needs-permission');
  const askPermissions = async () => {
    unlockVoice(); // phones only allow speech that starts from a tap
    setPermAsked(true);
    await compass.requestPermission(); // iPhone compass prompt (does nothing elsewhere)
    if (gps.status !== 'tracking') gps.start(); // browser location prompt
  };

  // ---------- Pause: stop location updates to save battery ----------
  useEffect(() => {
    if (demo) return;
    if (paused) {
      gps.stop();
      stoppedGps.current = true;
    } else if (stoppedGps.current) {
      gps.start();
      stoppedGps.current = false;
    }
  }, [paused, demo, gps.start, gps.stop]);
  // Leaving while paused: switch location back on for the map.
  useEffect(
    () => () => {
      if (stoppedGps.current) gps.start();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ---------- route (follows real roads & paths); straight line if none / offline ----------
  const requestRoute = (from: LngLat) => {
    return fetchRoutes(token, from, destination.coordinates, { ...routeOptions, mode: travelMode })
      .then(([best]) => {
        setRoute(prepareRoute(best));
        setRouteStatus('ok');
        return best.coordinates;
      })
      .catch((err: unknown) => {
        const offline = !navigator.onLine || (err as Error).message?.includes('internet');
        setRoute(null); // fall back to straight-line direction
        setRouteStatus(offline ? 'offline' : 'none');
        return null;
      });
  };

  // First route: from the demo start point, or from the first GPS position.
  const firstPosition = demo ? null : (fix?.position ?? null);
  const askedFirstRoute = useRef(false);
  useEffect(() => {
    if (askedFirstRoute.current) return;
    if (demo) {
      askedFirstRoute.current = true;
      const start = demoStart(destination.coordinates, travelMode);
      // The route ends on the nearest road; the pretend walker then walks the last bit to the exact
      // spot (into the mall / building), like a real person would.
      requestRoute(start).then((coords) => setDemoLine(measureLine([...(coords ?? [start]), destination.coordinates])));
      unlockVoice();
    } else if (firstPosition) {
      askedFirstRoute.current = true;
      requestRoute(firstPosition);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, firstPosition]);

  // ---------- the arrow ----------
  const guide = useMemo(
    () => (fix ? arrowTarget(fix.position, destination.coordinates, route, speedKmh) : null),
    [fix, destination.coordinates, route, speedKmh],
  );
  const lastAngle = useRef(0);
  const liveAngle = guide && heading !== null ? arrowAngle(fix!.position, guide.target, heading) : null;
  // No heading at all: point as on a north-up map (0 = north = up).
  const fallbackAngle = guide && heading === null ? arrowAngle(fix!.position, guide.target, 0) : null;
  const angle = gpsWeak || paused ? lastAngle.current : (liveAngle ?? fallbackAngle ?? lastAngle.current);
  if (!gpsWeak && !paused && (liveAngle ?? fallbackAngle) !== null) lastAngle.current = angle;
  const tone = gpsWeak || paused || liveAngle === null ? 'idle' : arrowTone(liveAngle);

  // ---------- off route? recalculate automatically ----------
  const offCount = useRef(0);
  const lastReroute = useRef(0);
  useEffect(() => {
    if (demo || !fix || !guide || rerouting) return;
    if (isOffRoute(guide.offRoute, fix.accuracy)) offCount.current++;
    else offCount.current = 0;
    if (offCount.current < 3 || Date.now() - lastReroute.current < REROUTE_GAP_MS) return;
    offCount.current = 0;
    lastReroute.current = Date.now();
    setRerouting(true);
    requestRoute(fix.position).finally(() => setRerouting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fix]);

  // Offline / no route earlier: try again when the internet comes back (and every 30 s).
  useEffect(() => {
    if (demo || routeStatus === 'ok' || routeStatus === 'loading') return;
    const retry = () => fix && requestRoute(fix.position);
    window.addEventListener('online', retry);
    const timer = window.setInterval(retry, 30000);
    return () => {
      window.removeEventListener('online', retry);
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeStatus, demo, fix === null]);

  // ---------- arrival ----------
  const straightToDest = fix ? distanceMeters(fix.position, destination.coordinates) : Infinity;
  useEffect(() => {
    if (arrived || !fix || gpsWeak) return;
    if (straightToDest <= arrivalRadius(fix.accuracy)) {
      setArrived(true);
      navigator.vibrate?.([300, 120, 300, 120, 500]); // strong buzz on arrival (Android)
      if (voiceEnabled) speak(t.arrived, { interrupt: true, lang: SPEECH_LANG[language] });
    }
  }, [arrived, fix, gpsWeak, straightToDest, voiceEnabled, t, language]);

  // ---------- voice cues + haptics ----------
  const cueState = useRef<{ candidate: VoiceCue | null; since: number; spoken: VoiceCue | null; at: number }>({
    candidate: null,
    since: 0,
    spoken: null,
    at: 0,
  });
  const prevTone = useRef(tone);
  useEffect(() => {
    // Light buzz when you swing back onto the right direction.
    if (tone === 'good' && (prevTone.current === 'near' || prevTone.current === 'wrong')) navigator.vibrate?.(40);
    prevTone.current = tone;
  }, [tone]);
  useEffect(() => {
    if (liveAngle === null || paused || arrived || gpsWeak) return;
    const now = Date.now();
    const s = cueState.current;
    const cue = cueForAngle(liveAngle);
    if (cue !== s.candidate) {
      s.candidate = cue;
      s.since = now;
      return;
    }
    if (!cue || cue === s.spoken || now - s.since < CUE_HOLD_MS || now - s.at < CUE_GAP_MS) return;
    // "Go straight" only after a turn cue - not as the very first thing, and not repeatedly.
    if (cue === 'goStraight' && s.spoken === null) return;
    s.spoken = cue;
    s.at = now;
    if (voiceEnabled) speak(t[cue], { interrupt: true, lang: SPEECH_LANG[language] });
  });

  // ---------- text under the arrow ----------
  const remaining = guide?.remaining ?? null;
  const eta = remaining !== null ? formatDuration(secondsLeft(remaining, speedKmh, guide?.routeSecondsLeft ?? null)) : null;

  let note: string | null = null; // one small status line, most important first
  if (paused) note = t.paused;
  else if (gpsWeak) note = t.searchingGps;
  else if (rerouting) note = t.offRoute;
  else if (routeStatus === 'offline') note = t.offline;
  else if (guide?.straightLine && routeStatus !== 'loading') note = t.straightLine;
  else if (!demo && compass.needsCalibration && compass.status === 'active') note = t.calibrate;
  else if (!demo && heading === null && compass.status === 'unsupported') note = t.noCompass;

  if (arrived) {
    return (
      <div className="nn-arrow nn-arrow--arrived" role="dialog" aria-label={t.youHaveArrived}>
        <div className="nn-arrow__arrived">
          <svg className="nn-arrow__check" viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="54" />
            <path d="M36 62 l16 16 l32 -36" />
          </svg>
          <h1>{t.youHaveArrived}</h1>
          <p>{destination.name}</p>
        </div>
        <button className="nn-arrow__done" onClick={onEnd}>
          {t.done}
        </button>
      </div>
    );
  }

  return (
    <div className={`nn-arrow${driving ? ' nn-arrow--driving' : ''}`} role="main" aria-label="Arrow Mode">
      {/* Top bar: back, destination chip, voice */}
      <div className="nn-arrow__top">
        <button className="nn-arrow__round" onClick={onShowMap} aria-label={t.back}>
          <BackIcon size={24} />
        </button>
        <div className="nn-arrow__chip">
          <PinIcon size={16} />
          <span>{destination.name}</span>
          {demo && <em>{t.demo}</em>}
        </div>
        <button
          className="nn-arrow__round"
          onClick={onToggleVoice}
          aria-label={voiceEnabled ? t.mute : t.unmute}
          aria-pressed={!voiceEnabled}
        >
          <SpeakerIcon muted={!voiceEnabled} />
        </button>
      </div>

      {/* The arrow */}
      <div className="nn-arrow__stage">
        <BigArrow angle={angle} tone={tone} />
        {tone === 'wrong' && <div className="nn-arrow__turnaround">{t.turnAround}</div>}
      </div>

      {/* Distance, place, time */}
      <div className="nn-arrow__info" aria-live="polite">
        <div className="nn-arrow__distance">{remaining !== null ? arrowDistance(remaining) : '– –'}</div>
        {driving && guide?.nextManeuver && guide.distanceToManeuver !== null ? (
          <div className="nn-arrow__nextturn">
            {/* Last stretch: show where you're going instead of "arrive in 0 m" */}
            {guide.nextManeuver.type === 'arrive'
              ? destination.name
              : t.nextTurn(turnLabel(guide.nextManeuver, t), arrowDistance(guide.distanceToManeuver))}
          </div>
        ) : (
          <>
            <div className="nn-arrow__place">{destination.name}</div>
            {eta && <div className="nn-arrow__eta">{t.left(eta)}</div>}
          </>
        )}
        {note && !driving && <div className="nn-arrow__note">{note}</div>}
      </div>

      {/* Bottom buttons */}
      <div className="nn-arrow__actions">
        <button className="nn-arrow__btn" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
          {paused ? t.resume : t.pause}
        </button>
        <button className="nn-arrow__btn" onClick={onShowMap}>
          {t.showMap}
        </button>
        <button className="nn-arrow__btn nn-arrow__btn--end" onClick={onEnd}>
          {t.end}
        </button>
      </div>

      {/* Why we need location + compass (shown once, before the browser prompts) */}
      {needsPermission && (
        <div className="nn-arrow__perm" role="dialog" aria-label={t.permTitle}>
          <div className="nn-arrow__perm-card">
            <h2>{t.permTitle}</h2>
            <p>{gps.status === 'denied' ? t.permDenied : t.permBody}</p>
            <button className="nn-arrow__done" onClick={askPermissions}>
              {t.permButton}
            </button>
            <button className="nn-arrow__perm-skip" onClick={onShowMap}>
              {t.back}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
