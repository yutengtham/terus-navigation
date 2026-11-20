import type { Map as MapboxMap } from 'mapbox-gl';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { MapView } from '../components/MapView';
import { TokenNotice } from '../components/TokenNotice';
import type { DemoRoute } from '../config/demoRoutes';
import { getGeoapifyKey, getMapboxToken } from '../config/env';
import { KUALA_LUMPUR, type LngLat } from '../config/malaysia';
import { useGeolocation } from '../hooks/useGeolocation';
import { isNightInMalaysia, useSettings } from '../hooks/useSettings';
import type { Place } from '../models/place';
import type { NavRoute, TripPoint } from '../models/route';
import { ArrowModeScreen } from '../screens/ArrowModeScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { NavigationScreen } from '../screens/NavigationScreen';
import { RoutePreviewScreen } from '../screens/RoutePreviewScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ReportSheet } from '../components/ReportSheet';
import { PosterScreen } from '../screens/PosterScreen';
import { WallOfShameScreen } from '../screens/WallOfShameScreen';
import { useReports } from '../hooks/useReports';
import type { RoadReport } from '../models/report';
import { clearReportPins, showReportPins } from '../services/reportLayers';
import { newReportId, reportsRepository } from '../services/reportsRepository';
import { gpsStatusMessage } from '../services/locationService';
import {
  clearDestinationPin,
  clearUserLocation,
  setDetailed3d,
  setLightPreset,
  setMapView,
  showDestinationPin,
  showUserLocation,
} from '../services/mapLayers';
import { clearRecentPlaces, placeFromPoint, saveRecentPlace } from '../services/searchService';
import { unlockVoice } from '../services/voiceService';
import { setDisplayUnits } from '../utils/format';

// three.js (3D preview) only downloads when the Avatar screen is opened.
const AvatarScreen = lazy(() => import('../screens/AvatarScreen'));

let demoReportSeeded = false;

type Screen = 'home' | 'search' | 'preview' | 'pick-origin' | 'pick-destination' | 'navigation' | 'settings' | 'arrow' | 'avatar' | 'wall';

/** A planned trip. origin 'gps' = "from my current location" (filled in once GPS answers). */
type Trip = { origin: TripPoint | 'gps'; destination: TripPoint; /** lanes & tolls demo */ demo?: boolean };

export function App() {
  const tokenStatus = getMapboxToken();
  const [map, setMap] = useState<MapboxMap | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [destination, setDestination] = useState<Place | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [activeRoute, setActiveRoute] = useState<NavRoute | null>(null);
  const [arrowTarget, setArrowTarget] = useState<TripPoint | null>(null); // Arrow Mode destination
  const [settings, updateSettings] = useSettings();
  /** Avatar screen opened over navigation (tapping the car while stopped) */
  const [avatarOverNav, setAvatarOverNav] = useState(false);
  // Hazard reports: the report form (where + road name), the poster being shown, and the user's reports
  const [reportAt, setReportAt] = useState<{ position: LngLat; road: string | null } | null>(null);
  const [poster, setPoster] = useState<RoadReport | null>(null);
  const [wallFrom, setWallFrom] = useState<Screen>('settings');
  const reports = useReports();
  const gps = useGeolocation();

  // Display units for every distance / speed shown (set before children render).
  setDisplayUnits(settings.units);

  // Day / night: "auto" follows Malaysia time, re-checked every minute.
  const [clockNight, setClockNight] = useState(isNightInMalaysia);
  useEffect(() => {
    const t = window.setInterval(() => setClockNight(isNightInMalaysia()), 60000);
    return () => window.clearInterval(t);
  }, []);
  const isNight = settings.appearance === 'auto' ? clockNight : settings.appearance === 'night';

  useEffect(() => {
    document.documentElement.dataset.theme = isNight ? 'dark' : 'light'; // dark cards & buttons
    if (map) setLightPreset(map, isNight ? 'night' : 'day');
  }, [map, isNight]);

  useEffect(() => {
    if (!map) return;
    setDetailed3d(map, settings.detailed3d);
    setMapView(map, settings.mapView); // 2D hides all 3D objects, so apply it after the detail setting
  }, [map, settings.detailed3d, settings.mapView]);

  const routeOptions = useMemo(
    () => ({
      avoidTolls: settings.avoidTolls,
      avoidHighways: settings.avoidHighways,
      avoidFerries: settings.avoidFerries,
      units: settings.units,
      mode: settings.travelMode,
    }),
    [settings.avoidTolls, settings.avoidHighways, settings.avoidFerries, settings.units, settings.travelMode],
  );

  // Live blue dot (hidden while driving, where the car is shown instead).
  useEffect(() => {
    if (!map) return;
    if (gps.fix && screen !== 'navigation') showUserLocation(map, gps.fix.position, gps.fix.accuracy);
    else clearUserLocation(map);
  }, [map, gps.fix, screen]);

  // Destination pin on the home screen (the route screens draw their own end point).
  useEffect(() => {
    if (!map) return;
    if (destination && (screen === 'home' || screen === 'search')) showDestinationPin(map, destination.coordinates);
    else clearDestinationPin(map);
  }, [map, destination, screen]);

  // Own reports as warning pins on the map (Settings -> Hazard reports).
  useEffect(() => {
    if (!map) return;
    if (settings.hazardReports) showReportPins(map, reports);
    else clearReportPins(map);
  }, [map, reports, settings.hazardReports]);

  // ?demo=fun: one sample pothole report, so a poster can be made on stage in seconds.
  useEffect(() => {
    if (new URLSearchParams(location.search).get('demo') !== 'fun' || demoReportSeeded) return;
    demoReportSeeded = true; // React runs effects twice in development: seed only once
    void reportsRepository.list().then((all) => {
      if (all.some((r) => r.demo)) return;
      void reportsRepository.save({
        id: newReportId(),
        type: 'pothole',
        createdAt: Date.now() - 25 * 60_000,
        location: [101.6738, 3.0995],
        roadName: 'Jalan Klang Lama',
        note: 'Sample report (demo)',
        photo: null,
        danger: 4,
        lineSeed: 0,
        demo: true,
      });
    });
  }, []);

  /** Road name for a report spot: OSM / Mapbox reverse geocoding, max 6 s, '' if unknown. */
  const lookupRoad = useMemo(
    () => (p: LngLat) =>
      Promise.race([
        placeFromPoint(tokenStatus.ok ? tokenStatus.token : '', p, getGeoapifyKey()).then((pl) => (pl.kind === 'pin' ? '' : pl.name)),
        new Promise<string>((res) => setTimeout(() => res(''), 6000)),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // "From my location": use the first GPS position that arrives, once.
  useEffect(() => {
    if (trip?.origin === 'gps' && gps.fix) {
      setTrip({ ...trip, origin: { name: 'Your location', coordinates: gps.fix.position, isCurrentLocation: true } });
    }
  }, [trip, gps.fix]);

  if (!tokenStatus.ok) {
    return <TokenNotice reason={tokenStatus.reason} />;
  }

  // The layers button menu changes these two settings directly.
  const mapStyleProps = {
    mapView: settings.mapView,
    appearance: settings.appearance,
    onChangeMapStyle: updateSettings,
  };

  const selectPlace = (place: Place) => {
    saveRecentPlace(place);
    setDestination(place);
    setScreen('home');
  };

  const planRouteTo = (place: Place) => {
    if (gps.status !== 'tracking') gps.start(); // asks for location if needed
    setTrip({
      origin: gps.fix ? { name: 'Your location', coordinates: gps.fix.position, isCurrentLocation: true } : 'gps',
      destination: { name: place.name, coordinates: place.coordinates },
    });
    setScreen('preview');
  };

  const planDemoRoute = (demo: DemoRoute) => {
    // The lanes & tolls demo is a car trip on the toll expressway, so it needs tolls & highways allowed.
    if (demo.id === 'B') updateSettings({ travelMode: 'driving', avoidTolls: false, avoidHighways: false });
    setTrip({
      origin: { name: demo.from.name, coordinates: demo.from.coords },
      destination: { name: demo.to.name, coordinates: demo.to.coords },
      demo: demo.id === 'B',
    });
    setScreen('preview');
  };

  const toTripPoint = (place: Place): TripPoint => ({ name: place.name, coordinates: place.coordinates });

  // Arrow Mode: opened from the route screen, after choosing Car / Walk / Cycle.
  const openArrowMode = (target: TripPoint) => {
    setArrowTarget(target);
    if (!settings.arrowDemo && gps.status !== 'tracking') gps.start();
    setScreen('arrow');
  };

  // Long-press on the map: show the pin straight away, then name it from the nearest address.
  const dropPin = (coordinates: LngLat) => {
    placeFromPoint(tokenStatus.ok ? tokenStatus.token : '', coordinates, getGeoapifyKey()).then((place) =>
      setDestination((current) => (current?.id === `pin:${coordinates[0].toFixed(6)},${coordinates[1].toFixed(6)}` || !current ? place : current)),
    );
    setDestination({
      id: `pin:${coordinates[0].toFixed(6)},${coordinates[1].toFixed(6)}`,
      name: 'Dropped pin',
      address: 'Finding address…',
      kind: 'pin',
      category: null,
      coordinates,
      source: 'pin',
    });
  };

  return (
    <>
      <MapView token={tokenStatus.token} onReady={setMap} />
      {map && screen === 'home' && (
        <HomeScreen
          map={map}
          gps={gps}
          destination={destination}
          {...mapStyleProps}
          onOpenSearch={() => setScreen('search')}
          onClearDestination={() => setDestination(null)}
          onDirections={planRouteTo}
          onPickPoint={dropPin}
          onStartDemo={planDemoRoute}
          onOpenSettings={() => setScreen('settings')}
          language={settings.language}
          onReport={
            settings.hazardReports
              ? () => setReportAt({ position: gps.fix?.position ?? [map.getCenter().lng, map.getCenter().lat], road: null })
              : null
          }
        />
      )}
      {map && screen === 'search' && (
        <SearchScreen
          token={tokenStatus.token}
          osmKey={getGeoapifyKey()}
          userPosition={gps.fix?.position ?? null}
          mapCenter={[map.getCenter().lng, map.getCenter().lat]}
          onSelect={selectPlace}
          onClose={() => setScreen('home')}
        />
      )}
      {map && screen === 'preview' && trip && (
        <RoutePreviewScreen
          map={map}
          token={tokenStatus.token}
          origin={trip.origin === 'gps' ? null : trip.origin}
          destination={trip.destination}
          routeOptions={routeOptions}
          onChangeMode={(travelMode) => updateSettings({ travelMode })}
          onArrowMode={() => openArrowMode(trip.destination)}
          preferMostTolls={trip.demo}
          hazardAlerts={settings.hazardAlerts}
          floodDemo={settings.floodDemo}
          language={settings.language}
          comfort={settings.comfort}
          onChangeComfort={(comfort) => updateSettings({ comfort })}
          onToggleTolls={(avoidTolls) => updateSettings({ avoidTolls })}
          onChangeAvoid={(changes) =>
            updateSettings(Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)))
          }
          onClearAvoid={() => updateSettings({ avoidTolls: false, avoidHighways: false, avoidFerries: false })}
          onUseTestOrigin={() => setTrip({ ...trip, origin: { name: 'KL city centre (test start)', coordinates: KUALA_LUMPUR } })}
          gpsMessage={gpsStatusMessage(gps.status)}
          onStart={(route) => {
            unlockVoice(); // phones only allow speech that starts from a tap
            setActiveRoute(route);
            setScreen('navigation');
          }}
          onClose={() => setScreen('home')}
          onEditOrigin={() => setScreen('pick-origin')}
          onEditDestination={() => setScreen('pick-destination')}
          onSwap={() => trip.origin !== 'gps' && setTrip({ origin: trip.destination, destination: trip.origin })}
        />
      )}
      {map && (screen === 'pick-origin' || screen === 'pick-destination') && trip && (
        <SearchScreen
          token={tokenStatus.token}
          osmKey={getGeoapifyKey()}
          userPosition={gps.fix?.position ?? null}
          placeholder={screen === 'pick-origin' ? 'Choose start point' : 'Choose destination'}
          mapCenter={[map.getCenter().lng, map.getCenter().lat]}
          onUseMyLocation={
            screen === 'pick-origin'
              ? () => {
                  if (gps.status !== 'tracking') gps.start();
                  setTrip({ ...trip, origin: gps.fix ? { name: 'Your location', coordinates: gps.fix.position, isCurrentLocation: true } : 'gps' });
                  setScreen('preview');
                }
              : undefined
          }
          onSelect={(place) => {
            saveRecentPlace(place);
            setTrip(screen === 'pick-origin' ? { ...trip, origin: toTripPoint(place) } : { ...trip, destination: toTripPoint(place) });
            setScreen('preview');
          }}
          onClose={() => setScreen('preview')}
        />
      )}
      {map && screen === 'navigation' && activeRoute && trip && (
        <NavigationScreen
          map={map}
          token={tokenStatus.token}
          route={activeRoute}
          destination={trip.destination}
          mode={trip.origin !== 'gps' && trip.origin.isCurrentLocation ? 'live' : 'simulated'}
          gps={gps}
          routeOptions={routeOptions}
          keepScreenOn={settings.keepScreenOn}
          voiceEnabled={settings.voice}
          onToggleVoice={() => updateSettings({ voice: !settings.voice })}
          {...mapStyleProps}
          laneGuidance={settings.laneGuidance}
          tollReminder={settings.tollReminder}
          language={settings.language}
          laneView={settings.laneView}
          hazardAlerts={settings.hazardAlerts}
          hazardVoice={settings.hazardVoice}
          floodDemo={settings.floodDemo}
          avatar={settings.avatar}
          voicePersonality={settings.voicePersonality}
          onReport={settings.hazardReports ? (position, road) => setReportAt({ position, road }) : null}
          onOpenAvatar={() => setAvatarOverNav(true)}
          onEnd={() => {
            setActiveRoute(null);
            setScreen('home');
          }}
        />
      )}
      {map && screen === 'arrow' && arrowTarget && (
        <ArrowModeScreen
          token={tokenStatus.token}
          destination={arrowTarget}
          gps={gps}
          language={settings.language}
          voiceEnabled={settings.voice}
          onToggleVoice={() => updateSettings({ voice: !settings.voice })}
          travelMode={settings.travelMode}
          routeOptions={routeOptions}
          demo={settings.arrowDemo}
          onShowMap={() => setScreen('preview')} // back to the route screen with its map
          onEnd={() => {
            setArrowTarget(null);
            setDestination(null);
            setScreen('home');
          }}
        />
      )}
      {map && screen === 'settings' && (
        <SettingsScreen
          settings={settings}
          onChange={updateSettings}
          onClearRecents={clearRecentPlaces}
          onClose={() => setScreen('home')}
          onOpenAvatar={() => setScreen('avatar')}
          onOpenWall={() => {
            setWallFrom('settings');
            setScreen('wall');
          }}
        />
      )}
      {map && screen === 'wall' && (
        <WallOfShameScreen language={settings.language} onOpen={setPoster} onClose={() => setScreen(wallFrom)} />
      )}
      {reportAt && (
        <ReportSheet
          language={settings.language}
          location={reportAt.position}
          roadHint={reportAt.road}
          lookupRoad={lookupRoad}
          onSaved={(r) => {
            setReportAt(null);
            setPoster(r);
          }}
          onClose={() => setReportAt(null)}
        />
      )}
      {poster && (
        <PosterScreen
          key={poster.id}
          report={poster}
          language={settings.language}
          onClose={() => setPoster(null)}
          onOpenWall={() => {
            setPoster(null);
            if (screen !== 'navigation') {
              setWallFrom(screen === 'wall' ? wallFrom : screen);
              setScreen('wall');
            }
          }}
        />
      )}
      {map && (screen === 'avatar' || (screen === 'navigation' && avatarOverNav)) && (
        <Suspense fallback={<div className="nn-screen nn-avatar nn-avatar--loading" />}>
          <AvatarScreen
            choice={settings.avatar}
            language={settings.language}
            onSave={(avatar) => {
              updateSettings({ avatar });
              if (screen === 'avatar') setScreen('settings');
              setAvatarOverNav(false);
            }}
            onClose={() => {
              if (screen === 'avatar') setScreen('settings');
              setAvatarOverNav(false);
            }}
          />
        </Suspense>
      )}
    </>
  );
}
