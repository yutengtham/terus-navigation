import type { Map as MapboxMap } from 'mapbox-gl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HazardPill } from '../components/HazardPill';
import { ReportButton } from '../components/ReportButton';
import { HazardSheet } from '../components/HazardSheet';
import { InstructionCard } from '../components/InstructionCard';
import { JunctionView } from '../components/JunctionView';
import { TollReminderCard } from '../components/TollReminderCard';
import { MapButton } from '../components/MapButton';
import { MapStyleButton } from '../components/MapStyleButton';
import { SosButton } from '../components/SosButton';
import { SpeedGauge } from '../components/SpeedGauge';
import { TripCard } from '../components/TripCard';
import { BikeIcon, CarIcon, NavArrowIcon, SpeakerIcon, WalkIcon } from '../components/icons';
import type { LngLat } from '../config/malaysia';
import type { GeolocationState } from '../hooks/useGeolocation';
import { presetFor, type AvatarChoice } from '../config/avatars';
import { useAvatarModel } from '../hooks/useAvatarModel';
import { useAvatarMotion } from '../hooks/useAvatarMotion';
import { useAvatarTag } from '../hooks/useAvatarTag';
import { AVATAR_STRINGS } from '../i18n/funStrings';
import { playHorn } from '../services/horn';
import { useHazardVoice } from '../hooks/useHazardVoice';
import { usePersonalityEvents } from '../hooks/usePersonalityEvents';
import type { PersonalityId } from '../config/data/voicePersonalities';
import { maybeJoke, resetJokes, setPersonality } from '../services/voiceJokes';
import { useLaneRibbon } from '../hooks/useLaneRibbon';
import { useRouteHazards } from '../hooks/useRouteHazards';
import { useLaneVoice } from '../hooks/useLaneVoice';
import { isNightInMalaysia } from '../hooks/useSettings';
import { useLiveDrive } from '../hooks/useLiveDrive';
import { useTollReminder } from '../hooks/useTollReminder';
import { useSimulatedDrive, type DriveFrame } from '../hooks/useSimulatedDrive';
import { useVoiceGuidance } from '../hooks/useVoiceGuidance';
import { useWakeLock } from '../hooks/useWakeLock';
import type { AppLanguage } from '../i18n/arrowStrings';
import { TOLL_STRINGS } from '../i18n/navStrings';
import type { NavRoute, TravelMode, TripPoint } from '../models/route';
import { lanesAreInformative } from '../services/laneGuidance';
import { laneAtOffset, laneCentreOffset, offsetPoint, type LaneProfile } from '../services/laneRibbon';
import { placeTolls, upcomingTolls } from '../services/tollAhead';
import { DirectionsError, fetchRoutes, type RouteOptions } from '../services/directionsService';
import { gpsStatusMessage } from '../services/locationService';
import { addCar, clearRoute, moveCar, removeCar, setBuildingFrontCutoff, showRoute } from '../services/mapLayers';
import { clearHazardSegments, hazardColour, HAZARD_RED, showHazardSegments } from '../services/hazardLayers';
import { severityRank } from '../services/routeHazards';
import { computeProgress, prepareRoute, type PreparedRoute } from '../services/routeProgress';
import { speak } from '../services/voiceService';
import { formatClock, formatDistance, formatDuration } from '../utils/format';
import { bearingDegrees, pointAlong } from '../utils/geo';

type Props = {
  map: MapboxMap;
  token: string;
  /** The real route chosen on the route preview screen. */
  route: NavRoute;
  destination: TripPoint;
  /** live = follow your real GPS position; simulated = a pretend car drives the route (testing). */
  mode: 'live' | 'simulated';
  gps: GeolocationState;
  /** Same travel mode, avoid options + units as the route preview, used when rerouting */
  routeOptions: Pick<RouteOptions, 'mode' | 'avoidTolls' | 'avoidHighways' | 'avoidFerries' | 'units'>;
  keepScreenOn: boolean;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  mapView: '3d' | '2d';
  appearance: 'auto' | 'day' | 'night';
  onChangeMapStyle: (changes: { mapView?: '3d' | '2d'; appearance?: 'auto' | 'day' | 'night' }) => void;
  onEnd: () => void;
  /** Settings: lane arrows / junction view / lane cue, and the next-toll card */
  laneGuidance: boolean;
  tollReminder: boolean;
  language: AppLanguage;
  /** Settings: lane-level road view on the 3D map */
  laneView: boolean;
  /** Settings: official flood & weather alerts, spoken hazard alerts, demo alerts */
  hazardAlerts: boolean;
  hazardVoice: boolean;
  floodDemo: boolean;
  /** The user's avatar (replaces the car when driving) */
  avatar: AvatarChoice;
  onOpenAvatar: () => void;
  /** Settings: fun voice personality */
  voicePersonality: PersonalityId;
  /** Hazard reports (null = setting off): called with the car's spot and the current road name */
  onReport: ((position: LngLat, roadName: string | null) => void) | null;
};

// Camera behind and above the car, close enough that the car and route look like
// the reference image (car ~45 px long on a phone).
const NAV_ZOOM = 18.8;
const NAV_PITCH = 60;
/** After the user moves the map, return to following the car after this long. */
const AUTO_RECENTER_MS = 6000;
/** Never ask for a new route more often than this (saves requests, avoids flicker). */
const MIN_REROUTE_GAP_MS = 15000;
/** Lane row appears this far before a junction (highway / city), and the junction view at 300 m. */
const LANES_FROM_HIGHWAY_M = 1500;
const LANES_FROM_CITY_M = 500;
const JUNCTION_VIEW_M = 300;

/** Puts the car in the lower-centre of the screen by padding the top of the map view. */
function navPadding(map: MapboxMap) {
  const h = map.getContainer().clientHeight;
  return { top: Math.round(h * 0.4), bottom: 0, left: 0, right: 0 };
}

const SIM_LABEL: Record<TravelMode, string> = { driving: 'DRIVE', walking: 'WALK', cycling: 'RIDE' };

/** Screen 4 - Active 3D navigation with live GPS, voice guidance and rerouting. */
export function NavigationScreen({
  map,
  token,
  route,
  destination,
  mode,
  gps,
  routeOptions,
  keepScreenOn,
  voiceEnabled,
  onToggleVoice,
  mapView,
  appearance,
  onChangeMapStyle,
  onEnd,
  laneGuidance,
  tollReminder,
  language,
  laneView,
  hazardAlerts,
  hazardVoice,
  floodDemo,
  avatar,
  onOpenAvatar,
  voicePersonality,
  onReport,
}: Props) {
  const [currentRoute, setCurrentRoute] = useState(route);
  const [prepared, setPrepared] = useState<PreparedRoute | null>(null);
  const [following, setFollowing] = useState(true);
  const [rerouting, setRerouting] = useState(false);
  const [rerouteError, setRerouteError] = useState<string | null>(null);
  const followingRef = useRef(true);
  const carPosRef = useRef<{ position: LngLat; bearing: number } | null>(null);
  const lastRerouteAt = useRef(0);
  const travelMode: TravelMode = routeOptions.mode ?? 'driving';

  useWakeLock(keepScreenOn); // keep the screen on while navigating (Settings)

  // 0. While navigating, buildings between the camera and the car are hidden so they never block the view.
  useEffect(() => {
    setBuildingFrontCutoff(map, true);
    return () => setBuildingFrontCutoff(map, false);
  }, [map]);

  // 1. Car on the map for as long as this screen is open.
  useEffect(() => {
    const start = (mode === 'live' && gps.fix?.position) || route.coordinates[0];
    const bearing = bearingDegrees(route.coordinates[0], route.coordinates[Math.min(5, route.coordinates.length - 1)]);
    addCar(map, start, bearing, travelMode); // 3D car, walker or bicycle
    carPosRef.current = { position: start, bearing };
    return () => {
      removeCar(map);
      carPosRef.current = null;
      clearRoute(map);
    };
    // Only on open / close.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // 1b. Avatar: once its model is ready, swap it in at the car's current position and heading.
  const avatarModel = useAvatarModel(avatar, travelMode);
  const usesAvatar = (travelMode === 'driving' || avatar.forAllModes) && avatar.body !== 'car';
  useEffect(() => {
    if (avatarModel === undefined) return; // still building
    const car = carPosRef.current;
    if (!car) return;
    addCar(map, car.position, car.bearing, travelMode, avatarModel);
    // travelMode is fixed for this screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, avatarModel]);

  // 2. Draw the route. First time: fly the camera behind the car. After a reroute: just swap the line.
  useEffect(() => {
    const p = prepareRoute(currentRoute);
    showRoute(map, currentRoute.coordinates);
    if (currentRoute !== route) {
      setPrepared(p); // a reroute: keep driving, no camera flight
      return;
    }
    let cancelled = false;
    const start = carPosRef.current?.position ?? currentRoute.coordinates[0];
    const startBearing = bearingDegrees(currentRoute.coordinates[0], pointAlong(p.line, 25));
    map.flyTo({
      center: start,
      zoom: NAV_ZOOM,
      pitch: NAV_PITCH,
      bearing: startBearing,
      padding: navPadding(map),
      duration: 2200,
    });
    map.once('moveend', () => {
      if (!cancelled) setPrepared(p);
    });
    return () => {
      cancelled = true;
    };
  }, [map, currentRoute, route]);

  // 3. Stop following the car when the user moves the map; come back after 6 s.
  const resumeTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const stopFollowing = (e: { originalEvent?: unknown }) => {
      if (!e.originalEvent) return; // ignore camera moves made by our own code
      followingRef.current = false;
      setFollowing(false);
      window.clearTimeout(resumeTimer.current);
    };
    const scheduleResume = (e: { originalEvent?: unknown }) => {
      if (!e.originalEvent || followingRef.current) return;
      window.clearTimeout(resumeTimer.current);
      resumeTimer.current = window.setTimeout(() => recenterRef.current(), AUTO_RECENTER_MS);
    };
    const starts = ['dragstart', 'rotatestart', 'pitchstart', 'zoomstart'] as const;
    const ends = ['dragend', 'rotateend', 'pitchend', 'zoomend'] as const;
    starts.forEach((ev) => map.on(ev, stopFollowing));
    ends.forEach((ev) => map.on(ev, scheduleResume));
    return () => {
      starts.forEach((ev) => map.off(ev, stopFollowing));
      ends.forEach((ev) => map.off(ev, scheduleResume));
      window.clearTimeout(resumeTimer.current);
    };
  }, [map]);

  // 4. Every animation frame: move the car and (if following) the camera.
  // Lane view: the car is drawn in its lane (set below once the lane profile exists).
  const laneProfileRef = useRef<LaneProfile | null>(null);
  const gpsFixRef = useRef(gps.fix);
  gpsFixRef.current = gps.fix;
  const onFrame = useCallback(
    (f: DriveFrame) => {
      let position = f.position;
      const profile = laneProfileRef.current;
      if (profile) {
        let offset = profile.guideOffsetAt(f.traveled); // display: in the recommended lane
        const fix = gpsFixRef.current;
        if (mode === 'live' && fix && fix.accuracy <= 4) {
          // Good GPS: put the car in the lane it is really in (sideways distance from the route line).
          const b = (f.bearing * Math.PI) / 180;
          const dx = (fix.position[0] - f.position[0]) * 111320 * Math.cos((f.position[1] * Math.PI) / 180);
          const dy = (fix.position[1] - f.position[1]) * 110574;
          const lateral = dx * Math.cos(b) - dy * Math.sin(b);
          const n = Math.max(1, Math.round(profile.countAt(f.traveled)));
          offset = laneCentreOffset(laneAtOffset(lateral, n), n);
        }
        position = offsetPoint(f.position, f.bearing, offset);
      }
      moveCar(map, position, f.bearing);
      carPosRef.current = { position, bearing: f.bearing };
      if (followingRef.current) {
        map.jumpTo({ center: position, bearing: f.bearing, zoom: NAV_ZOOM, pitch: NAV_PITCH, padding: navPadding(map) });
      }
    },
    [map, mode],
  );
  // Only one of these runs, depending on the mode.
  const simFrame = useSimulatedDrive(mode === 'simulated' ? prepared : null, onFrame, travelMode);
  const liveFrame = useLiveDrive(mode === 'live' ? prepared : null, gps.fix, onFrame);
  const frame = mode === 'live' ? liveFrame : simFrame;

  // Lane-level road view: car navigation in 3D and 2D (walking and cycling keep the route line).
  const night = appearance === 'night' || (appearance === 'auto' && isNightInMalaysia());
  const laneProfile = useLaneRibbon(map, prepared, frame?.traveled ?? null, laneView && travelMode === 'driving', night);
  laneProfileRef.current = laneProfile;

  // 5. Off the route? Ask Mapbox for a new route from where you are now.
  const offRoute = mode === 'live' && (liveFrame?.offRoute ?? false);
  useEffect(() => {
    if (!offRoute || rerouting || !gps.fix) return;
    if (Date.now() - lastRerouteAt.current < MIN_REROUTE_GAP_MS) return;
    lastRerouteAt.current = Date.now();
    setRerouting(true);
    setRerouteError(null);
    if (voiceEnabled) speak('Rerouting.', { interrupt: true });
    maybeJoke({ event: 'reroute', toManeuverM: Infinity, toNextInstructionM: Infinity, complex: false }, voiceEnabled);
    fetchRoutes(token, gps.fix.position, destination.coordinates, routeOptions)
      .then(([best]) => setCurrentRoute(best))
      .catch((err: unknown) => setRerouteError(err instanceof DirectionsError ? err.message : 'Could not find a new route.'))
      .finally(() => setRerouting(false));
    // routeOptions is a fresh object each render; its values only change in Settings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offRoute, rerouting, gps.fix, token, destination.coordinates, voiceEnabled]);

  // 6. Voice: speak Mapbox's instructions at the right distance.
  useVoiceGuidance(prepared, frame?.traveled ?? null, voiceEnabled);

  const recenter = () => {
    window.clearTimeout(resumeTimer.current);
    const car = carPosRef.current;
    if (!car) return;
    map.easeTo({
      center: car.position,
      zoom: NAV_ZOOM,
      pitch: NAV_PITCH,
      bearing: car.bearing,
      padding: navPadding(map),
      duration: 700,
    });
    map.once('moveend', () => {
      followingRef.current = true;
      setFollowing(true);
    });
  };
  const recenterRef = useRef(recenter);
  useEffect(() => {
    recenterRef.current = recenter;
  });

  const progress = useMemo(
    () => (prepared ? computeProgress(prepared, frame?.traveled ?? 0) : null),
    [prepared, frame?.traveled],
  );
  const arrived = frame?.finished ?? false;
  const arrival = progress ? formatClock(new Date(Date.now() + progress.remainingDuration * 1000)) : '--';
  // Road name for the card ("· Jalan Tun Razak"). Mapbox puts an instruction ("Turn left") or a
  // destination sentence there when a road has no name - those would just repeat the card.
  const rawTowards = progress ? currentRoute.steps[progress.stepIndex]?.towards : null;
  const towards =
    rawTowards && !/^(turn|bear|keep|continue|make|take|head|drive|go|your destination)\b/i.test(rawTowards) ? rawTowards : null;

  // ----- Lane guidance (only when Mapbox has lane data and some lanes are NOT for you) -----
  const step = progress ? currentRoute.steps[progress.stepIndex] : undefined;
  const nextStep = progress ? currentRoute.steps[progress.stepIndex + 1] : undefined;
  const stepLanes = laneGuidance && !arrived && lanesAreInformative(step?.lanes) ? step!.lanes : null;
  const lanesFrom = step?.highway ? LANES_FROM_HIGHWAY_M : LANES_FROM_CITY_M;
  const lanes = stepLanes && progress && progress.distanceToManeuver <= lanesFrom ? stepLanes : null;
  const showJunction = !!lanes && !!progress && progress.distanceToManeuver <= JUNCTION_VIEW_M;
  // Road / exit name for the card and voice; no name -> route number (e.g. "E23").
  const roadName = towards ?? (nextStep?.name || nextStep?.ref || null);
  useLaneVoice(
    progress && lanes
      ? {
          key: progress.stepIndex,
          lanes,
          maneuver: progress.nextManeuver,
          distance: progress.distanceToManeuver,
          towards: roadName,
          visible: true,
        }
      : null,
    voiceEnabled && laneGuidance,
    language,
    prepared,
  );

  // ----- Next toll plaza (distance along the route from your snapped position) -----
  const tollPoints = useMemo(
    () => (prepared ? placeTolls(prepared.line, currentRoute.tollPlazas) : []),
    [prepared, currentRoute],
  );
  const aheadTolls = tollReminder && !arrived ? upcomingTolls(tollPoints, frame?.traveled ?? 0) : [];
  const nextToll = aheadTolls[0] ?? null;
  const tollNear = useTollReminder(nextToll, voiceEnabled, language, prepared);

  // ----- Official flood & weather alerts on the route (car only; refreshed every 10 min + on reroute) -----
  const hazardRoutes = useMemo(() => [currentRoute], [currentRoute]);
  const hazardReport = useRouteHazards(hazardRoutes, hazardAlerts && travelMode === 'driving', floodDemo)[0] ?? null;
  const traveledM = frame?.traveled ?? null;
  const routeHazards = useMemo(() => hazardReport?.hazards ?? [], [hazardReport]);
  // Still ahead (or around the car right now). Pill: red alerts (flood warning / danger) first,
  // then the nearest; at the same spot the most severe.
  const traveledKm = (traveledM ?? 0) / 1000;
  const aheadHazards = arrived ? [] : routeHazards.filter((h) => h.segment.endKm > traveledKm);
  const isRed = (h: (typeof routeHazards)[number]) => (hazardColour(h) === HAZARD_RED ? 1 : 0);
  const pillHazard =
    [...aheadHazards].sort(
      (a, b) =>
        isRed(b) - isRed(a) ||
        Math.max(0, a.segment.startKm - traveledKm) - Math.max(0, b.segment.startKm - traveledKm) ||
        severityRank(b.severity) - severityRank(a.severity),
    )[0] ?? null;
  const [hazardSheetOpen, setHazardSheetOpen] = useState(false);
  const stopped = (frame?.speedKmh ?? 0) < 5;
  useEffect(() => {
    if (!stopped) setHazardSheetOpen(false); // details only while stopped
  }, [stopped]);
  useHazardVoice(aheadHazards, traveledM, voiceEnabled && hazardVoice, language, prepared);
  // Colour the affected stretches on the map (under the route line and lane ribbon).
  useEffect(() => {
    if (!prepared || !routeHazards.length) {
      clearHazardSegments(map);
      return;
    }
    showHazardSegments(map, prepared.line, routeHazards);
  }, [map, prepared, routeHazards]);
  useEffect(() => () => clearHazardSegments(map), [map]);

  // ----- Voice personality: jokes follow the real instructions (see services/voiceJokes.ts) -----
  // Personalities are written for driving; walking / cycling keep the Standard voice.
  useEffect(() => setPersonality(travelMode === 'driving' ? voicePersonality : 'standard'), [voicePersonality, travelMode]);
  useEffect(() => resetJokes(), [route]);
  usePersonalityEvents(
    prepared,
    frame?.traveled ?? null,
    frame?.speedKmh ?? 0,
    tollNear,
    voiceEnabled && travelMode === 'driving',
  );

  // ----- Avatar extras: idle / arrival animation, floating name tag, horn when tapped while stopped -----
  const avatarPreset = usesAvatar && avatar.body !== 'upload' ? presetFor(avatar.body) : null;
  const redrawCar = useCallback(() => {
    const car = carPosRef.current;
    if (car) moveCar(map, car.position, car.bearing);
  }, [map]);
  useAvatarMotion(map, avatarPreset, !stopped, arrived, redrawCar);
  useAvatarTag(map, carPosRef, travelMode === 'driving' || avatar.forAllModes ? avatar.name : '');
  const [avatarChip, setAvatarChip] = useState(false);
  const stoppedRef = useRef(stopped);
  stoppedRef.current = stopped;
  useEffect(() => {
    const onClick = (e: { point: { x: number; y: number } }) => {
      const car = carPosRef.current;
      if (!car || !stoppedRef.current) return;
      const p = map.project(car.position);
      if (Math.hypot(p.x - e.point.x, p.y - e.point.y) > 70) return;
      playHorn(presetFor(avatar.body === 'upload' ? 'car' : avatar.body).horn);
      setAvatarChip(true);
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map, avatar.body]);
  useEffect(() => {
    if (!avatarChip) return;
    const t = window.setTimeout(() => setAvatarChip(false), 5000);
    return () => window.clearTimeout(t);
  }, [avatarChip]);

  // One short status line at a time, most important first.
  let status: { text: string; tone: 'info' | 'warn' } | null = null;
  if (mode === 'simulated') status = { text: `SIMULATED ${SIM_LABEL[travelMode]} · start isn’t your location`, tone: 'info' };
  if (mode === 'live') {
    const gpsProblem = gpsStatusMessage(gps.status);
    if (gpsProblem) status = { text: gpsProblem, tone: 'warn' };
    else if (!gps.fix) status = { text: 'Waiting for GPS signal…', tone: 'info' };
    else if (gps.stale) status = { text: 'GPS signal lost – position not updating', tone: 'warn' };
    else if (rerouting) status = { text: 'Rerouting…', tone: 'info' };
    else if (rerouteError) status = { text: `Can’t reroute: ${rerouteError}`, tone: 'warn' };
    else if (offRoute) status = { text: 'Off route', tone: 'warn' };
  }

  let distanceText = 'Starting…';
  if (arrived) distanceText = destination.name;
  else if (progress) distanceText = formatDistance(progress.distanceToManeuver) + (roadName ? ` · ${roadName}` : '');

  return (
    <div className={`nn-overlay${lanes ? ' nn-overlay--lanes' : ''}`}>
      <InstructionCard maneuver={progress?.nextManeuver ?? null} distanceText={distanceText} onClose={onEnd} lanes={lanes} />
      {showJunction && lanes && <JunctionView lanes={lanes} maneuver={progress?.nextManeuver ?? null} />}
      {/* Hazard pill sits under the instruction card; it steps aside for the junction view near a turn. */}
      {pillHazard && !showJunction && (
        <HazardPill
          hazard={pillHazard}
          distance={Math.max(0, (pillHazard.segment.startKm - traveledKm) * 1000)}
          canOpen={stopped}
          onOpen={() => setHazardSheetOpen(true)}
        />
      )}
      {hazardSheetOpen && hazardReport && (
        <HazardSheet
          hazards={routeHazards}
          notes={hazardReport.notes}
          language={language}
          checkedAt={hazardReport.checkedAt}
          onClose={() => setHazardSheetOpen(false)}
        />
      )}

      <SpeedGauge speedKmh={frame?.speedKmh ?? 0} />
      {/* Next toll: left side under the speed gauge, away from the car in the lower middle */}
      {/* Left column under the gauge: next toll, then the Report button (kept clear of SOS on the right) */}
      {(nextToll || onReport) && (
        <div className="nn-left-stack">
          {nextToll && (
            <TollReminderCard next={nextToll} after={aheadTolls[1] ?? null} near={tollNear} t={TOLL_STRINGS[language]} />
          )}
          {onReport && (
            <ReportButton
              language={language}
              moving={!stopped}
              onReport={() => {
                const car = carPosRef.current;
                const st = progress ? currentRoute.steps[progress.stepIndex] : undefined;
                if (car) onReport(car.position, st ? [st.name, st.ref].filter(Boolean).join(' ') || null : null);
              }}
            />
          )}
        </div>
      )}

      <div className="nn-side-buttons">
        <MapStyleButton mapView={mapView} appearance={appearance} onChange={onChangeMapStyle} />
        <MapButton label="Recenter" onClick={recenter} active={!following}>
          <NavArrowIcon />
        </MapButton>
        <MapButton label={voiceEnabled ? 'Mute voice guidance' : 'Turn on voice guidance'} onClick={onToggleVoice}>
          <SpeakerIcon muted={!voiceEnabled} />
        </MapButton>
      </div>

      <div className="nn-bottom-stack">
        <SosButton
          fix={gps.fix}
          roadName={
            progress
              ? [currentRoute.steps[progress.stepIndex]?.name, currentRoute.steps[progress.stepIndex]?.ref]
                  .filter(Boolean)
                  .join(' ') || null
              : null
          }
          className="nn-sos-button--stack"
        />
        {avatarChip && stopped && (
          <button
            className="nn-recenter-pill"
            onClick={() => {
              setAvatarChip(false);
              onOpenAvatar();
            }}
          >
            {AVATAR_STRINGS[language].changeAvatar}
          </button>
        )}
        {!following && (
          // Appears whenever the camera is not following the car. Also returns automatically after 6 s.
          <button className="nn-recenter-pill" onClick={recenter}>
            {travelMode === 'walking' ? <WalkIcon /> : travelMode === 'cycling' ? <BikeIcon /> : <CarIcon />}
            Re-centre
          </button>
        )}
        {status && <div className={`nn-demo-badge nn-status--${status.tone}`}>{status.text}</div>}
        <TripCard
          durationText={progress ? (arrived ? 'Arrived' : formatDuration(progress.remainingDuration)) : '--'}
          distanceText={progress ? formatDistance(progress.remainingDistance) : '--'}
          arrivalText={arrival}
          onEnd={onEnd}
        />
      </div>
    </div>
  );
}
