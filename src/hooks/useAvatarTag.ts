import mapboxgl, { type Map as MapboxMap } from 'mapbox-gl';
import { useEffect, type RefObject } from 'react';
import type { LngLat } from '../config/malaysia';

/** Floating name tag above the avatar; follows the car every frame. */
export function useAvatarTag(map: MapboxMap, carPos: RefObject<{ position: LngLat } | null>, name: string): void {
  useEffect(() => {
    if (!name) return;
    const el = document.createElement('div');
    el.className = 'nn-avatar-tag';
    el.textContent = name;
    const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom', offset: [0, -58], pitchAlignment: 'viewport' });
    let added = false;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const p = carPos.current?.position;
      if (!p) return;
      marker.setLngLat(p);
      if (!added) {
        marker.addTo(map);
        added = true;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      marker.remove();
    };
  }, [map, carPos, name]);
}
