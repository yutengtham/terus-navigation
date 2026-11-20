import type { Map as MapboxMap } from 'mapbox-gl';
import { useEffect } from 'react';
import type { AvatarPreset } from '../config/avatars';
import { setCarLift, setCarSpin } from '../services/mapLayers';

/**
 * Small idle animation (animals bob, vehicles bounce a little) and a one-off arrival
 * animation (hop or spin). Updates one paint property ~30 times a second - cheap on mid-range phones.
 */
export function useAvatarMotion(map: MapboxMap, preset: AvatarPreset | null, moving: boolean, arrived: boolean, redraw: () => void): void {
  useEffect(() => {
    if (!preset || preset.idle === 'none') return;
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 33) return;
      last = t;
      const s = t / 1000;
      const lift = preset.idle === 'bob' ? Math.abs(Math.sin(s * (moving ? 7 : 2.5))) * (moving ? 0.25 : 0.12) : moving ? Math.abs(Math.sin(s * 11)) * 0.06 : 0;
      setCarLift(map, lift);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      setCarLift(map, 0);
    };
  }, [map, preset, moving]);

  useEffect(() => {
    if (!preset || !arrived) return;
    const start = performance.now();
    const DURATION = 1600;
    let raf = 0;
    const loop = (t: number) => {
      const k = Math.min(1, (t - start) / DURATION);
      if (preset.arrive === 'hop') setCarLift(map, Math.abs(Math.sin(k * Math.PI * 3)) * 1.4 * (1 - k * 0.5));
      else {
        setCarSpin(k * 720);
        redraw(); // the car only re-reads its heading when moved
      }
      if (k < 1) raf = requestAnimationFrame(loop);
      else {
        setCarLift(map, 0);
        setCarSpin(0);
        redraw();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [map, preset, arrived, redraw]);
}
