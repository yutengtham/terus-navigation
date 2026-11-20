import type { MapMouseEvent, MapTouchEvent, Map as MapboxMap } from 'mapbox-gl';
import { useEffect, useRef, useState } from 'react';
import { DestinationCard } from '../components/DestinationCard';
import { GpsBanner } from '../components/GpsBanner';
import { MapButton } from '../components/MapButton';
import { MapStyleButton } from '../components/MapStyleButton';
import { ReportButton } from '../components/ReportButton';
import type { AppLanguage } from '../i18n/arrowStrings';
import { SosButton } from '../components/SosButton';
import { GearIcon, NavArrowIcon, SearchIcon, UpArrowIcon } from '../components/icons';
import { DEMO_ROUTE_A, DEMO_ROUTE_B, type DemoRoute } from '../config/demoRoutes';
import { INITIAL_CAMERA, type LngLat } from '../config/malaysia';
import type { GeolocationState } from '../hooks/useGeolocation';
import type { Place } from '../models/place';

type Props = {
  map: MapboxMap;
  gps: GeolocationState;
  destination: Place | null;
  mapView: '3d' | '2d';
  appearance: 'auto' | 'day' | 'night';
  onChangeMapStyle: (changes: { mapView?: '3d' | '2d'; appearance?: 'auto' | 'day' | 'night' }) => void;
  onOpenSearch: () => void;
  onClearDestination: () => void;
  onDirections: (place: Place) => void;
  /** Long-press (or right-click) on the map: drop a pin there */
  onPickPoint: (coordinates: LngLat) => void;
  onStartDemo: (route: DemoRoute) => void;
  onOpenSettings: () => void;
  /** Hazard reports: shown when the setting is on */
  onReport: (() => void) | null;
  language: AppLanguage;
};

const NO_PADDING = { top: 0, bottom: 0, left: 0, right: 0 };

/** Screen 1 - Home map: search bar, layers + my-location buttons, destination details / demo launcher. */
export function HomeScreen({
  map,
  gps,
  destination,
  mapView,
  appearance,
  onChangeMapStyle,
  onOpenSearch,
  onClearDestination,
  onDirections,
  onPickPoint,
  onStartDemo,
  onOpenSettings,
  onReport,
  language,
}: Props) {
  const [bannerHidden, setBannerHidden] = useState(false);
  const flyToMeWhenReady = useRef(false);

  // Return to the overview camera when coming back to this screen (unless a destination is shown).
  useEffect(() => {
    if (!destination) map.easeTo({ ...INITIAL_CAMERA, padding: NO_PADDING, duration: 1200 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Fly to a destination picked in search.
  useEffect(() => {
    if (destination) {
      map.flyTo({
        center: destination.coordinates,
        zoom: 16,
        pitch: 55,
        padding: { ...NO_PADDING, bottom: 220 },
        duration: 1800,
      });
    }
  }, [map, destination]);

  // After tapping "my location", fly there as soon as the first GPS reading arrives.
  useEffect(() => {
    if (flyToMeWhenReady.current && gps.fix) {
      flyToMeWhenReady.current = false;
      map.flyTo({ center: gps.fix.position, zoom: 16.5, pitch: 55, padding: NO_PADDING, duration: 1600 });
    }
  }, [map, gps.fix]);

  // Long-press anywhere on the map (right-click on a computer) to drop a pin there.
  // Mapbox has no long-press event, so we time a still finger ourselves.
  const pickRef = useRef(onPickPoint);
  useEffect(() => {
    pickRef.current = onPickPoint;
  });
  useEffect(() => {
    let timer: number | undefined;
    let start: { x: number; y: number } | null = null;
    const cancel = () => {
      window.clearTimeout(timer);
      start = null;
    };
    const onTouchStart = (e: MapTouchEvent) => {
      cancel();
      if (e.points.length !== 1) return; // pinch-zoom, not a press
      start = { x: e.point.x, y: e.point.y };
      const at: LngLat = [e.lngLat.lng, e.lngLat.lat];
      timer = window.setTimeout(() => {
        navigator.vibrate?.(20);
        pickRef.current(at);
      }, 550);
    };
    const onTouchMove = (e: MapTouchEvent) => {
      if (start && Math.hypot(e.point.x - start.x, e.point.y - start.y) > 10) cancel();
    };
    const onContextMenu = (e: MapMouseEvent) => pickRef.current([e.lngLat.lng, e.lngLat.lat]);
    map.on('touchstart', onTouchStart);
    map.on('touchmove', onTouchMove);
    map.on('touchend', cancel);
    map.on('touchcancel', cancel);
    map.on('movestart', cancel);
    map.on('contextmenu', onContextMenu);
    return () => {
      cancel();
      map.off('touchstart', onTouchStart);
      map.off('touchmove', onTouchMove);
      map.off('touchend', cancel);
      map.off('touchcancel', cancel);
      map.off('movestart', cancel);
      map.off('contextmenu', onContextMenu);
    };
  }, [map]);

  const onLocate = () => {
    setBannerHidden(false);
    if (gps.status === 'tracking' && gps.fix) {
      map.flyTo({ center: gps.fix.position, zoom: 16.5, pitch: 55, padding: NO_PADDING, duration: 1400 });
    } else {
      flyToMeWhenReady.current = true;
      gps.start(); // shows the browser's "Allow location?" prompt the first time
    }
  };

  return (
    <div className="nn-overlay">
      <button className="nn-card nn-search" onClick={onOpenSearch} aria-label="Search places in Malaysia">
        <SearchIcon />
        <span className={`nn-search__label${destination ? ' has-value' : ''}`}>
          {destination ? destination.name : 'Search places in Malaysia'}
        </span>
      </button>

      {!bannerHidden && (
        <GpsBanner
          status={gps.status}
          stale={gps.stale}
          accuracy={gps.fix?.accuracy ?? null}
          onRetry={onLocate}
          onDismiss={() => setBannerHidden(true)}
        />
      )}

      <div className="nn-side-buttons nn-side-buttons--home">
        <MapStyleButton mapView={mapView} appearance={appearance} onChange={onChangeMapStyle} />
        <MapButton label="Show my location" onClick={onLocate} active={gps.status === 'tracking'}>
          <NavArrowIcon />
        </MapButton>
        <MapButton label="Settings" onClick={onOpenSettings}>
          <GearIcon />
        </MapButton>
        {onReport && <ReportButton language={language} moving={(gps.fix?.speedKmh ?? 0) >= 5} onReport={onReport} />}
      </div>

      <div className="nn-bottom-stack">
        <SosButton fix={gps.fix} className="nn-sos-button--stack" />
        {destination ? (
          <DestinationCard
            place={destination}
            userPosition={gps.fix?.position ?? null}
            onClose={onClearDestination}
            onDirections={() => onDirections(destination)}
            />
        ) : (
          <div className="nn-card nn-trip nn-home-card">
            <div className="nn-trip__handle" />
            <div className="nn-trip__row">
              <div className="nn-trip__info">
                <div className="nn-home-card__title">Try a demo route</div>
                <div className="nn-trip__meta">{DEMO_ROUTE_A.label}</div>
              </div>
              <button className="nn-primary-button" onClick={() => onStartDemo(DEMO_ROUTE_A)}>
                <UpArrowIcon size={24} />
                Demo
              </button>
            </div>
            <button className="nn-link-button nn-home-card__demo2" onClick={() => onStartDemo(DEMO_ROUTE_B)}>
              Lanes &amp; tolls demo · Bangsar → Damansara Utama
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
