import type { Map as MapboxMap } from 'mapbox-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildLaneProfile, buildRibbon, type LaneProfile, type LaneSample } from '../services/laneRibbon';
import { ensureRibbonLayers, removeRibbon, setRibbonData, setRibbonNight, setRibbonVisible } from '../services/laneRibbonLayers';
import { fetchOsmLaneSamples } from '../services/osmLanes';
import type { PreparedRoute } from '../services/routeProgress';

/** Rebuild the ribbon after the car has moved this far (not every frame - keeps phones smooth). */
const REBUILD_EVERY_M = 20;
/** Part of the route drawn: from just behind the car to well ahead. */
const BEHIND_M = 200;
const AHEAD_M = 1500;

/**
 * Lane-level road view on the map during 3D car navigation. Builds the lane profile once per
 * route (Mapbox junction lanes + OpenStreetMap lanes + defaults), redraws the ribbon around the
 * car every ~20 m, and gives back the profile so the car can be drawn in its lane.
 * Any failure falls back silently to the normal route line.
 */
export function useLaneRibbon(
  map: MapboxMap,
  prepared: PreparedRoute | null,
  traveled: number | null,
  enabled: boolean,
  night: boolean,
): LaneProfile | null {
  const [osm, setOsm] = useState<LaneSample[]>([]);

  // OpenStreetMap lane tags: one cached request per route (none while disabled).
  useEffect(() => {
    setOsm([]);
    if (!enabled || !prepared) return;
    let cancelled = false;
    fetchOsmLaneSamples(prepared.line)
      .then((s) => !cancelled && setOsm(s))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [prepared, enabled]);

  const profile = useMemo(() => {
    if (!enabled || !prepared) return null;
    try {
      return buildLaneProfile(prepared.route, prepared.line, prepared.stepEnds, osm);
    } catch {
      return null;
    }
  }, [prepared, osm, enabled]);

  // Layers live while enabled; removing them restores the normal route line.
  useEffect(() => {
    if (!enabled) return;
    ensureRibbonLayers(map, night);
    return () => removeRibbon(map);
    // night is applied by the effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, enabled]);

  useEffect(() => {
    if (enabled) setRibbonNight(map, night);
  }, [map, enabled, night]);

  // Redraw around the car every ~20 m, or straight away for a new route / profile.
  const lastBuilt = useRef<{ at: number; profile: LaneProfile | null; visible: boolean }>({ at: -Infinity, profile: null, visible: false });
  useEffect(() => {
    if (!enabled || !prepared) return;
    const last = lastBuilt.current;
    const at = traveled ?? 0;
    if (last.profile === profile && Math.abs(at - last.at) < REBUILD_EVERY_M) return;
    let visible = false;
    if (profile) {
      try {
        const ribbon = buildRibbon(profile, prepared.line, at - BEHIND_M, at + AHEAD_M);
        setRibbonData(map, ribbon);
        visible = ribbon.features.length > 0;
      } catch {
        visible = false; // fall back to the normal route line
      }
    }
    // Re-apply after a new route too: the route line layers are re-created then.
    if (visible !== last.visible || last.profile !== profile) setRibbonVisible(map, visible);
    lastBuilt.current = { at, profile, visible };
  }, [map, prepared, profile, traveled, enabled]);

  return enabled ? profile : null;
}
