import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { INITIAL_CAMERA } from '../config/malaysia';
import { MAP_STYLE_URL, novaNavBasemapConfig } from '../theme/mapStyle';

type Props = {
  token: string;
  /** Called once the map has finished loading, so other parts of the app can use it. */
  onReady?: (map: mapboxgl.Map) => void;
};

/**
 * Full-screen interactive 3D map.
 * This component only draws the map - navigation logic will live in /services.
 */
export function MapView({ token, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Keep the latest onReady in a ref so a new function never re-creates the map.
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      config: { basemap: novaNavBasemapConfig },
      center: INITIAL_CAMERA.center,
      zoom: INITIAL_CAMERA.zoom,
      pitch: INITIAL_CAMERA.pitch,
      bearing: INITIAL_CAMERA.bearing,
      maxPitch: 75,
      antialias: true, // smoother 3D building edges
      attributionControl: true, // required by Mapbox's terms - do not remove
    });
    mapRef.current = map;
    if (import.meta.env.DEV) (window as unknown as { __nnMap?: mapboxgl.Map }).__nnMap = map; // dev debugging only

    map.on('load', () => onReadyRef.current?.(map));

    // Turn common Mapbox errors into plain-English messages.
    map.on('error', (e) => {
      const status = (e.error as { status?: number } | undefined)?.status;
      if (status === 401) {
        setError('Mapbox rejected the token (401). Check that VITE_MAPBOX_TOKEN in .env.local is correct.');
      } else if (status === 403) {
        setError(
          'Mapbox blocked this address (403). Add this page’s URL (e.g. http://localhost:5173) to your token’s URL restrictions.',
        );
      } else {
        console.error('[Terus map error]', e.error);
      }
    });

    // Keep the map sized correctly when the phone rotates or the window resizes.
    const resize = () => map.resize();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  return (
    <>
      <div ref={containerRef} className="nn-map" />
      {error && (
        <div className="nn-notice">
          <div className="nn-card">
            <h1>Map could not load</h1>
            <p>{error}</p>
          </div>
        </div>
      )}
    </>
  );
}
