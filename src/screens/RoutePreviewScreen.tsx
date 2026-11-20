import type { Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ComfortBar } from '../components/ComfortBar';
import { HazardBanner } from '../components/HazardBanner';
import { WeatherChip } from '../components/WeatherChip';
import { useRouteHazards } from '../hooks/useRouteHazards';
import type { AppLanguage } from '../i18n/arrowStrings';
import type { DestinationForecast } from '../models/hazard';
import { demoHazardData } from '../services/demoHazards';
import { checkRouteHazards, destinationForecast, floodAvoidPoints } from '../services/routeHazards';
import { bearingAlong, measureLine, snapToLine } from '../utils/geo';
import type { LngLat } from '../config/malaysia';
import {
  ArrowModeIcon,
  BackIcon,
  BikeIcon,
  CarIcon,
  PinIcon,
  SunIcon,
  SwapIcon,
  UmbrellaIcon,
  UpArrowIcon,
  WalkIcon,
} from '../components/icons';
import type { NavRoute, TravelMode, TripPoint } from '../models/route';
import {
  comfortCost,
  loadComfortData,
  scoreRoute,
  type ComfortData,
  type ComfortPreference,
  type ComfortScore,
} from '../services/comfortService';
import { DirectionsError, fetchCarRouteChoices, fetchRouteChoices, fetchRoutes, type RouteOptions } from '../services/directionsService';
import { estimateTolls, formatRM, type TollEstimate } from '../services/tollEstimate';
import { TOLL_RATES_CHECKED } from '../config/tollRates';
import { ALT_LAYER, clearAlternatives, clearRoute, showAlternatives, showRoute } from '../services/mapLayers';
import { formatClock, formatDistance, formatDuration } from '../utils/format';

type Props = {
  map: MapboxMap;
  token: string;
  /** null while waiting for the first GPS position */
  origin: TripPoint | null;
  destination: TripPoint;
  /** Travel mode, avoid tolls / highways / ferries + units, from Settings */
  routeOptions: Pick<RouteOptions, 'mode' | 'avoidTolls' | 'avoidHighways' | 'avoidFerries' | 'units'>;
  onChangeMode: (mode: TravelMode) => void;
  /** Lanes & tolls demo: pre-select the route that passes the most toll plazas. */
  preferMostTolls?: boolean;
  /** Open Arrow Mode to the destination, using the chosen travel mode */
  onArrowMode: () => void;
  /** Walking / cycling: fastest, shaded or sheltered (Settings) */
  comfort: ComfortPreference;
  onChangeComfort: (p: ComfortPreference) => void;
  onToggleTolls: (avoid: boolean) => void;
  /** Change avoid options straight from this screen (e.g. "Show toll routes", "Turn off" highways) */
  onChangeAvoid: (changes: { avoidTolls?: boolean; avoidHighways?: boolean; avoidFerries?: boolean }) => void;
  /** Turn off every "avoid" option (when no route exists with them on). */
  onClearAvoid: () => void;
  /** Offer a fixed test start (KL city centre) when GPS is unavailable, e.g. on a desktop. */
  onUseTestOrigin: () => void;
  gpsMessage: string | null;
  onStart: (route: NavRoute) => void;
  onClose: () => void;
  /** Open search to choose a different start point. */
  onEditOrigin: () => void;
  /** Open search to choose a different destination. */
  onEditDestination: () => void;
  /** Swap start and destination. */
  onSwap: () => void;
  /** Settings: official flood & weather alerts (car routes) */
  hazardAlerts: boolean;
  /** Settings / ?demo=flood: add fake alerts for presenting */
  floodDemo: boolean;
  language: AppLanguage;
};

const MODES: { mode: TravelMode; label: string; Icon: typeof CarIcon }[] = [
  { mode: 'driving', label: 'Car', Icon: CarIcon },
  { mode: 'walking', label: 'Walk', Icon: WalkIcon },
  { mode: 'cycling', label: 'Cycle', Icon: BikeIcon },
];
const SIM_BUTTON: Record<TravelMode, string> = {
  driving: 'Simulate drive',
  walking: 'Simulate walk',
  cycling: 'Simulate ride',
};

/** Screen 3 - Route preview: real routes, alternatives, avoid-tolls switch, Start navigation. */
export function RoutePreviewScreen({
  map,
  token,
  origin,
  destination,
  routeOptions,
  onChangeMode,
  preferMostTolls = false,
  onArrowMode,
  comfort,
  onChangeComfort,
  onToggleTolls,
  onChangeAvoid,
  onClearAvoid,
  onUseTestOrigin,
  gpsMessage,
  onStart,
  onClose,
  onEditOrigin,
  onEditDestination,
  onSwap,
  hazardAlerts,
  floodDemo,
  language,
}: Props) {
  const [routes, setRoutes] = useState<NavRoute[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<DirectionsError | null>(null);
  /** Car only: a clearly faster route that the avoid options are hiding */
  const [fasterHidden, setFasterHidden] = useState<NavRoute | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const travelMode: TravelMode = routeOptions.mode ?? 'driving';
  const isCar = travelMode === 'driving';
  // Shade & shelter (walking / cycling only)
  const [comfortData, setComfortData] = useState<ComfortData | null>(null);
  const [checking, setChecking] = useState(false);
  const [departure, setDeparture] = useState<number | null>(null); // null = now
  // Flood & weather alerts (car): index of the "Avoid flood areas" route once added, and its status
  const [avoidIndex, setAvoidIndex] = useState<number | null>(null);
  const [avoidState, setAvoidState] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  const [forecast, setForecast] = useState<DestinationForecast | null>(null);

  // Fetch real routes whenever the trip or the toll setting changes.
  const originKey = origin ? origin.coordinates.join(',') : null;
  useEffect(() => {
    if (!origin) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const request = { ...routeOptions, alternatives: true, signal: controller.signal };
    setFasterHidden(null);
    setAvoidIndex(null);
    setAvoidState({ loading: false, error: null });
    (isCar
      ? fetchCarRouteChoices(token, origin.coordinates, destination.coordinates, request)
      : fetchRouteChoices(token, origin.coordinates, destination.coordinates, request).then((r) => ({
          routes: r.slice(0, 4),
          fasterWithoutAvoid: null,
        }))
    )
      .then(({ routes: r, fasterWithoutAvoid }) => {
        setRoutes(r);
        setFasterHidden(fasterWithoutAvoid);
        // Demo: start on the route with the most toll plazas (Kerinchi Link + Damansara Link).
        const most = preferMostTolls
          ? r.reduce((best, x, i) => (x.tollPlazas.length > r[best].tollPlazas.length ? i : best), 0)
          : 0;
        setSelected(most);
      })
      .catch((err: unknown) => {
        if ((err as Error).name === 'AbortError') return;
        setRoutes([]);
        setError(err instanceof DirectionsError ? err : new DirectionsError('Something went wrong while finding routes.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // originKey stands in for origin so a new GPS reading does not re-fetch the same trip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    token,
    originKey,
    destination.coordinates,
    routeOptions.mode,
    routeOptions.avoidTolls,
    routeOptions.avoidHighways,
    routeOptions.avoidFerries,
    routeOptions.units,
  ]);

  // Walking / cycling: load buildings + covered walkways around the routes, once per set of routes.
  useEffect(() => {
    setComfortData(null);
    if (isCar || !routes.length) return;
    let cancelled = false;
    setChecking(true);
    // 1) buildings from Mapbox (about a second) -> show shade right away;
    // 2) then add covered walkways from OpenStreetMap when that slower lookup answers.
    loadComfortData(token, routes, false)
      .then((d) => !cancelled && setComfortData((prev) => prev ?? d))
      .catch(() => {});
    loadComfortData(token, routes, true)
      .then((d) => !cancelled && setComfortData(d))
      .catch(() => {})
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [token, routes, isCar]);

  // Shade depends on the leaving time (the sun moves); shelter doesn't.
  const scores = useMemo<ComfortScore[] | null>(() => {
    if (!comfortData) return null;
    const when = new Date(departure ?? Date.now());
    return routes.map((r) => scoreRoute(r, comfortData, when));
  }, [comfortData, routes, departure]);

  // Recommended = lowest "comfort cost" (time, made worse by sun / rain exposure). List in that order.
  const order = useMemo(() => {
    const idx = routes.map((_, i) => i);
    if (isCar || !scores) return idx;
    return idx.sort((a, b) => comfortCost(routes[a], scores[a], comfort) - comfortCost(routes[b], scores[b], comfort));
  }, [routes, scores, comfort, isCar]);
  useEffect(() => {
    if (scores) setSelected(order[0] ?? 0);
  }, [order, scores]);
  // Car toll estimates (verified open-system rates only; see config/tollRates.ts).
  const tolls = useMemo(() => routes.map((r) => estimateTolls(r)), [routes]);
  // Official alerts per route (same order as `routes`). Quietly empty if data.gov.my is unavailable.
  const hazardReports = useRouteHazards(routes, hazardAlerts && isCar, floodDemo);
  const selectedReport = hazardReports[selected] ?? null;
  const floodRouteIndex = hazardReports.findIndex((r, i) => r?.floodOnRoute && i !== avoidIndex);
  const avoidReport = avoidIndex !== null ? hazardReports[avoidIndex] : undefined;

  // Today's official forecast at the destination (cached 3 hours).
  useEffect(() => {
    setForecast(null);
    if (!hazardAlerts) return;
    let alive = true;
    void destinationForecast(destination.coordinates).then((f) => alive && setForecast(f));
    return () => {
      alive = false;
    };
  }, [hazardAlerts, destination.coordinates]);

  // "Avoid flood areas": 1) pick an existing route that is clear of the official flood alerts;
  // 2) otherwise ask Mapbox for routes that keep off the alert spots (exclude points + a detour
  //    either side), check each against the same alerts, and keep only one that is really clear.
  const avoidFloods = async () => {
    if (!origin || floodRouteIndex < 0) return;
    const clearIdx = routes.map((_, i) => i).filter((i) => hazardReports[i] && !hazardReports[i]?.floodOnRoute);
    if (clearIdx.length) {
      const best = clearIdx.reduce((a, b) => (routes[b].duration < routes[a].duration ? b : a));
      setAvoidIndex(best);
      setSelected(best);
      return;
    }
    const fi = selectedReport?.floodOnRoute ? selected : floodRouteIndex;
    const flagged = hazardReports[fi];
    const route = routes[fi];
    if (!flagged || !route) return;
    setAvoidState({ loading: true, error: null });
    try {
      const line = measureLine(route.coordinates);
      const points = floodAvoidPoints(flagged.hazards, line);
      const spot = points[Math.floor(points.length / 2)];
      const vias = spot ? sideDetours(spot, bearingAlong(line, snapToLine(line, spot).along), 900) : [];
      const opts = { ...routeOptions, alternatives: false };
      const tries = await Promise.allSettled([
        fetchRoutes(token, origin.coordinates, destination.coordinates, { ...opts, excludePoints: points }),
        ...vias.map((via) => fetchRoutes(token, origin.coordinates, destination.coordinates, { ...opts, via })),
      ]);
      const candidates = tries.flatMap((t) => (t.status === 'fulfilled' ? [t.value[0]] : []));
      const demoData = floodDemo ? await demoHazardData(routes[0].coordinates) : null;
      const checked = await Promise.all(candidates.map((c) => checkRouteHazards(c.coordinates, c.duration, { demo: demoData })));
      const okIdx = checked.map((c, i) => (c && !c.floodOnRoute ? i : -1)).filter((i) => i >= 0);
      if (!okIdx.length) {
        setAvoidState({ loading: false, error: 'No clear route found. Drive carefully.' });
        return;
      }
      const pick = candidates[okIdx.reduce((a, b) => (candidates[b].duration < candidates[a].duration ? b : a))];
      setRoutes((prev) => [...prev, pick]);
      setAvoidIndex(routes.length);
      setSelected(routes.length);
      setAvoidState({ loading: false, error: null });
    } catch (err) {
      setAvoidState({ loading: false, error: err instanceof DirectionsError ? err.message : 'Could not find another route right now.' });
    }
  };

  const fastestIndex = routes.reduce((best, r, i) => (r.duration < routes[best].duration ? i : best), 0);
  const sunDown = !!scores && scores.every((sc) => sc.shade === null);

  // Draw the routes: selected one mint-green with chevrons, others soft blue.
  useEffect(() => {
    if (!routes.length) {
      clearAlternatives(map);
      clearRoute(map);
      return;
    }
    showRoute(map, routes[selected].coordinates);
    showAlternatives(
      map,
      routes.map((r) => r.coordinates),
      selected,
    );
  }, [map, routes, selected]);

  // Fit the whole trip between the top card and the bottom sheet (only when new routes arrive).
  useEffect(() => {
    if (!routes.length) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const r of routes) {
      for (const [x, y] of r.coordinates) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    const top = (topRef.current?.getBoundingClientRect().bottom ?? 120) + 30;
    const bottom = (sheetRef.current?.offsetHeight ?? 300) + 40;
    map.fitBounds(
      [
        [minX, minY],
        [maxX, maxY],
      ],
      {
        padding: { top, bottom, left: 40, right: 40 },
        pitch: 40,
        bearing: 0,
        duration: 1400,
        maxZoom: 16.5,
      },
    );
  }, [map, routes]);

  // Tap a blue alternative on the map to choose it.
  useEffect(() => {
    const onClick = (e: MapMouseEvent) => {
      const index = (e.features?.[0] as { properties?: { index?: unknown } } | undefined)?.properties?.index;
      if (typeof index === 'number') setSelected(index);
    };
    const pointer = () => (map.getCanvas().style.cursor = 'pointer');
    const normal = () => (map.getCanvas().style.cursor = '');
    map.on('click', ALT_LAYER, onClick);
    map.on('mouseenter', ALT_LAYER, pointer);
    map.on('mouseleave', ALT_LAYER, normal);
    return () => {
      map.off('click', ALT_LAYER, onClick);
      map.off('mouseenter', ALT_LAYER, pointer);
      map.off('mouseleave', ALT_LAYER, normal);
      normal();
    };
  }, [map]);

  // Leaving the screen: remove the preview lines (the navigation screen draws its own).
  useEffect(
    () => () => {
      clearAlternatives(map);
      clearRoute(map);
    },
    [map],
  );

  // Arrival times count from the chosen leaving time (walking / cycling) or now.
  const now = (!isCar && departure) || Date.now();

  return (
    <div className="nn-overlay">
      <div ref={topRef} className="nn-card nn-route-top">
        <button className="nn-icon-button" onClick={onClose} aria-label="Back">
          <BackIcon />
        </button>
        <div className="nn-route-top__points">
          <button className="nn-route-top__row" onClick={onEditOrigin} aria-label="Change start point">
            <span className="nn-dot-start" />
            <span className="nn-route-top__name">{origin ? origin.name : 'Waiting for your location…'}</span>
          </button>
          <div className="nn-route-top__line" />
          <button className="nn-route-top__row" onClick={onEditDestination} aria-label="Change destination">
            <span className="nn-dot-end">
              <PinIcon size={14} />
            </span>
            <span className="nn-route-top__name">{destination.name}</span>
          </button>
        </div>
        <button
          className="nn-icon-button nn-route-top__swap"
          onClick={onSwap}
          disabled={!origin}
          aria-label="Swap start and destination"
        >
          <SwapIcon />
        </button>
      </div>

      <div ref={sheetRef} className="nn-card nn-route-sheet">
        <div className="nn-trip__handle" />

        <div className="nn-mode-tabs" role="radiogroup" aria-label="Travel mode">
          {MODES.map(({ mode, label, Icon }) => (
            <button
              key={mode}
              role="radio"
              aria-checked={mode === travelMode}
              className={`nn-mode-tab${mode === travelMode ? ' is-active' : ''}`}
              onClick={() => onChangeMode(mode)}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </div>

        {!isCar && (
          <ComfortBar
            preference={comfort}
            onChangePreference={onChangeComfort}
            departure={departure}
            onChangeDeparture={setDeparture}
          />
        )}
        {!isCar && origin && !loading && checking && (
          <div className="nn-route-sheet__checking">{comfortData ? 'Adding covered walkways…' : 'Checking shade & shelter…'}</div>
        )}
        {!isCar && sunDown && comfort === 'shade' && (
          <div className="nn-route-sheet__checking">
            The sun is down at that time, so shade doesn’t matter – ranked by shelter.
          </div>
        )}

        {!origin && (
          <div className="nn-route-sheet__message">
            <p>{gpsMessage ?? 'Finding your location to plan the route…'}</p>
            <div className="nn-route-sheet__links">
              <button className="nn-link-button" onClick={onEditOrigin}>
                Choose a start point
              </button>
              <button className="nn-link-button nn-link-button--muted" onClick={onUseTestOrigin}>
                Start from KL city centre (testing)
              </button>
            </div>
          </div>
        )}

        {origin && loading && <div className="nn-route-sheet__message">Finding routes…</div>}

        {origin && !loading && error && (
          <div className="nn-route-sheet__message">
            <p>{error.message}</p>
            {error.reason === 'no-route-with-avoid' && (
              <button className="nn-link-button" onClick={onClearAvoid}>
                Show all routes
              </button>
            )}
          </div>
        )}

        {isCar && origin && !loading && !error && selectedReport && selectedReport.hazards.length > 0 && (
          <HazardBanner hazards={selectedReport.hazards} notes={selectedReport.notes} language={language} checkedAt={selectedReport.checkedAt} />
        )}
        {isCar && !loading && floodRouteIndex >= 0 && avoidIndex === null && (
          <div className="nn-hazavoid">
            {avoidState.error && <span>{avoidState.error}</span>}
            {!avoidState.error && (
              <button className="nn-link-button" onClick={() => void avoidFloods()} disabled={avoidState.loading}>
                {avoidState.loading ? 'Finding…' : 'Avoid flood areas'}
              </button>
            )}
          </div>
        )}
        {isCar && avoidIndex !== null && avoidReport?.floodOnRoute && (
          <div className="nn-hazavoid">
            <span>No clear route found. Drive carefully.</span>
          </div>
        )}
        {forecast && origin && !loading && <WeatherChip forecast={forecast} />}

        {origin && !loading && !error && routes.length > 0 && (
          <ul className="nn-route-list" aria-label="Route choices">
            {order.map((i) => {
              const r = routes[i];
              const sc = scores?.[i];
              return (
                <li key={i}>
                  <button
                    className={`nn-route-option${i === selected ? ' is-selected' : ''}`}
                    onClick={() => setSelected(i)}
                    aria-pressed={i === selected}
                  >
                    <span className="nn-route-option__main">
                      <span className="nn-route-option__time">{formatDuration(r.duration)}</span>
                      <span className="nn-route-option__meta">
                        {formatDistance(r.distance)}
                        {r.summary && ` · via ${r.summary}`}
                      </span>
                      {isCar && (hazardReports[i]?.floodOnRoute || (i === avoidIndex && hazardReports[i])) && (
                        <span className="nn-comfort-chips">
                          {hazardReports[i]?.floodOnRoute ? (
                            <span className="nn-chip nn-chip--flood">Flood alert</span>
                          ) : (
                            <span className="nn-chip nn-chip--avoids">Avoids flood alert</span>
                          )}
                        </span>
                      )}
                      {!isCar && (sc || i === fastestIndex) && (
                        <span className="nn-comfort-chips">
                          {i === order[0] && comfort !== 'fastest' && sc && (
                            <span className="nn-chip nn-chip--best">Recommended</span>
                          )}
                          {i === fastestIndex && routes.length > 1 && <span className="nn-chip">Fastest</span>}
                          {sc && (
                            <span className="nn-chip nn-chip--shade">
                              <SunIcon size={12} />
                              {sc.shade === null ? 'Sun down' : `${Math.round(sc.shade * 100)}% shade`}
                            </span>
                          )}
                          {sc && (
                            <span className="nn-chip nn-chip--shelter">
                              <UmbrellaIcon size={12} />
                              {Math.round(sc.shelter * 100)}% sheltered
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                    <span className="nn-route-option__side">
                      <span className="nn-route-option__arrive">{formatClock(new Date(now + r.duration * 1000))}</span>
                      {isCar && (
                        <span className={`nn-badge ${r.hasTolls ? 'nn-badge--toll' : 'nn-badge--free'}`}>
                          {tollBadge(r.hasTolls, tolls[i])}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {isCar && !loading && routeOptions.avoidTolls && routes.length > 0 && routes.every((r) => r.hasTolls) && (
          // e.g. to Penang island: every road crosses a tolled bridge.
          <div className="nn-route-sheet__checking">No toll-free route exists for this trip – showing the routes with the fewest tolls.</div>
        )}

        {isCar && !loading && fasterHidden && routes[0] && (
          // The avoid options are hiding a clearly faster route: say so instead of hiding it silently.
          <div className="nn-faster">
            <div className="nn-faster__text">
              <strong>{formatDuration(routes[0].duration - fasterHidden.duration)} faster</strong>
              {fasterHidden.hasTolls ? ' with tolls' : ' using highways'}
              {' · '}
              {formatDuration(fasterHidden.duration)}
              {fasterHidden.hasTolls && ` · ${tollBadge(true, estimateTolls(fasterHidden))}`}
            </div>
            <button className="nn-link-button" onClick={() => onChangeAvoid({ avoidTolls: false, avoidHighways: false })}>
              {fasterHidden.hasTolls ? 'Show toll routes' : 'Show all routes'}
            </button>
          </div>
        )}

        {isCar && !loading && routes[selected]?.hasTolls && tolls[selected] && (
          <TollBreakdown estimate={tolls[selected]} />
        )}

        {isCar && (
          <label className="nn-switch-row">
            <span>Avoid toll roads</span>
            <input
              type="checkbox"
              role="switch"
              className="nn-switch"
              checked={!!routeOptions.avoidTolls}
              onChange={(e) => onToggleTolls(e.target.checked)}
            />
          </label>
        )}

        {((isCar && routeOptions.avoidHighways) || routeOptions.avoidFerries) && (
          <div className="nn-route-sheet__also">
            <span>
              {isCar ? 'Also avoiding ' : 'Avoiding '}
              {[isCar && routeOptions.avoidHighways && 'highways', routeOptions.avoidFerries && 'ferries']
                .filter(Boolean)
                .join(' and ')}
            </span>
            <button
              className="nn-link-button"
              onClick={() => onChangeAvoid({ avoidHighways: isCar ? false : undefined, avoidFerries: false })}
            >
              Turn off
            </button>
          </div>
        )}

        <div className="nn-route-sheet__actions">
          <button
            className="nn-primary-button nn-route-sheet__start"
            disabled={!routes[selected] || loading}
            onClick={() => routes[selected] && onStart(routes[selected])}
          >
            <UpArrowIcon size={22} />
            {origin?.isCurrentLocation || !origin ? 'Start navigation' : SIM_BUTTON[travelMode]}
          </button>
          {/* Arrow Mode: one big arrow instead of the map, for the chosen Car / Walk / Cycle */}
          <button className="nn-secondary-button nn-route-sheet__arrow" onClick={onArrowMode} aria-label="Arrow Mode">
            <ArrowModeIcon />
            <span>Arrow Mode</span>
          </button>
        </div>
        <div className="nn-route-sheet__note">
          {origin && !origin.isCurrentLocation
            ? 'Live guidance needs the start to be your location – this start gives a simulated preview. '
            : ''}
          {isCar
            ? `Times use Mapbox traffic data where available. Tolls are car (Class 1) estimates from published rates checked ${TOLL_RATES_CHECKED}, without festive discounts.`
            : 'Walking and cycling paths come from map data, which can be incomplete in Malaysia – watch for traffic and use crossings. Shade is estimated from building heights and the sun’s position for your leaving time (trees not counted). Covered walkways © OpenStreetMap contributors.'}
          {!isCar &&
            comfortData &&
            !checking &&
            !comfortData.coveredWalkwaysLoaded &&
            ' Covered-walkway data didn’t load, so shelter may be under-counted.'}
        </div>
      </div>
    </div>
  );
}

/** Two points `metres` to the left and right of `p`, across the road direction (for detours). */
function sideDetours(p: LngLat, bearingDeg: number, metres: number): LngLat[] {
  const kx = 111320 * Math.cos((p[1] * Math.PI) / 180);
  const ky = 110574;
  return [90, -90].map((turn) => {
    const b = ((bearingDeg + turn) * Math.PI) / 180;
    return [p[0] + (Math.sin(b) * metres) / kx, p[1] + (Math.cos(b) * metres) / ky] as LngLat;
  });
}

/** "No tolls", "Toll RM4.40", "Toll RM4.40+" (some plazas not priced) or just "Tolls". */
function tollBadge(hasTolls: boolean, est: TollEstimate | undefined): string {
  if (!hasTolls) return 'No tolls';
  if (!est || est.priced.length === 0) return 'Tolls';
  return `Toll ${formatRM(est.total)}${est.complete ? '' : '+'}`;
}

/** Which plazas make up the toll for the chosen route, and which we couldn't price. */
function TollBreakdown({ estimate }: { estimate: TollEstimate }) {
  return (
    <div className="nn-tolls">
      {estimate.priced.length > 0 && (
        <div className="nn-tolls__line">
          <strong>
            {estimate.complete ? 'Toll' : 'Known tolls'} {formatRM(estimate.total)}
          </strong>
          {' · '}
          {estimate.priced.map((p) => `${p.highway} ${p.plaza.replace(/^Plaza Toll? /i, '')} ${formatRM(p.rm)}`).join(', ')}
        </div>
      )}
      {estimate.unpriced.length > 0 && (
        <div className="nn-tolls__line nn-tolls__line--muted">
          Not priced: {estimate.unpriced.map((n) => n.replace(/^Plaza Toll? /i, '')).join(', ')} – distance-based or unconfirmed.{' '}
          <a href="https://kadartol.llm.gov.my" target="_blank" rel="noreferrer">
            Check official rates
          </a>
        </div>
      )}
    </div>
  );
}
