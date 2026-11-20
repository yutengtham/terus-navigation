/*
 * Lane guidance from the Mapbox Directions API.
 *
 * Two places in a Mapbox response describe lanes:
 *  1. bannerInstructions[].sub.components with type "lane" (best: made for display)
 *       { type: 'lane', directions: ['straight', 'right'], active: true, active_direction: 'right' }
 *  2. steps[].intersections[].lanes (fallback)
 *       { indications: ['straight'], valid: true, active: true, valid_indication: 'straight' }
 *
 * A step's banner describes the maneuver at the END of that step, and the same junction's
 * lanes are on the next step's first intersection. Both are turned into one simple model.
 * If Mapbox has no lane data for a junction we return null - lanes are never invented.
 */

export const LANE_INDICATIONS = [
  'straight',
  'slight right',
  'right',
  'sharp right',
  'uturn',
  'slight left',
  'left',
  'sharp left',
] as const;
export type LaneIndication = (typeof LANE_INDICATIONS)[number];

/** One lane, left to right. */
export type Lane = {
  /** Arrows painted on the lane, e.g. ['straight', 'right'] */
  indications: LaneIndication[];
  /** true = a lane you can use for the route */
  recommended: boolean;
  /** Which of its arrows the route follows (when known) */
  preferredIndication?: LaneIndication;
};

// ---------- Mapbox shapes (only the fields we read) ----------
export type ApiLaneComponent = {
  type: string;
  text?: string;
  directions?: string[];
  active?: boolean;
  active_direction?: string;
};
export type ApiBanner = {
  distanceAlongGeometry: number;
  primary?: { text?: string; type?: string; modifier?: string };
  sub?: { text?: string; components?: ApiLaneComponent[] };
};
export type ApiIntersectionLane = {
  indications?: string[];
  valid?: boolean;
  active?: boolean;
  valid_indication?: string;
};

function toIndication(value: string | undefined): LaneIndication | undefined {
  return LANE_INDICATIONS.find((i) => i === value);
}
function toIndications(values: string[] | undefined): LaneIndication[] {
  const list = (values ?? []).map(toIndication).filter((v): v is LaneIndication => v !== undefined);
  return list.length ? list : ['straight']; // "none" (no painted arrow) is drawn as straight
}

/** Lanes from a banner's "sub" row; null when the banner has no lane components. */
export function lanesFromBanner(banner: ApiBanner | undefined): Lane[] | null {
  const parts = (banner?.sub?.components ?? []).filter((c) => c.type === 'lane');
  if (parts.length === 0) return null;
  return parts.map((c) => ({
    indications: toIndications(c.directions),
    recommended: c.active === true,
    preferredIndication: c.active ? (toIndication(c.active_direction) ?? toIndication(c.directions?.[0])) : undefined,
  }));
}

/** Lanes from an intersection's lane list; null when there is none. */
export function lanesFromIntersection(lanes: ApiIntersectionLane[] | undefined): Lane[] | null {
  if (!lanes || lanes.length === 0) return null;
  const anyActive = lanes.some((l) => l.active);
  return lanes.map((l) => {
    // "active" marks the preferred lanes; if Mapbox marks none, every valid lane is fine.
    const recommended = l.valid === true && (l.active === true || !anyActive);
    return {
      indications: toIndications(l.indications),
      recommended,
      preferredIndication: recommended ? (toIndication(l.valid_indication) ?? toIndication(l.indications?.[0])) : undefined,
    };
  });
}

/**
 * Lanes for the maneuver at the end of a step: the closest banner with lane data,
 * otherwise the lanes at the maneuver point (first intersection of the next step).
 */
export function lanesForManeuver(banners: ApiBanner[] | undefined, nextStepLanes: ApiIntersectionLane[] | undefined): Lane[] | null {
  const withLanes = (banners ?? []).filter((b) => lanesFromBanner(b));
  if (withLanes.length) {
    // Banners are listed far-to-near; the nearest one describes the junction best.
    const nearest = withLanes.reduce((a, b) => (b.distanceAlongGeometry < a.distanceAlongGeometry ? b : a));
    return lanesFromBanner(nearest);
  }
  return lanesFromIntersection(nextStepLanes);
}

/** Worth showing? Only when some lanes are NOT recommended - otherwise it tells you nothing. */
export function lanesAreInformative(lanes: Lane[] | null | undefined): lanes is Lane[] {
  return !!lanes && lanes.length > 1 && lanes.some((l) => l.recommended) && lanes.some((l) => !l.recommended);
}

export type LanePosition = { side: 'left' | 'right' | 'middle' | 'mixed'; count: number; positions: number[] };

/** Where the recommended lanes are, e.g. "the two right lanes" -> { side: 'right', count: 2 }. */
export function describeRecommended(lanes: Lane[]): LanePosition {
  const positions = lanes.flatMap((l, i) => (l.recommended ? [i + 1] : []));
  const count = positions.length;
  const contiguous = positions.every((p, i) => i === 0 || p === positions[i - 1] + 1);
  let side: LanePosition['side'] = 'mixed';
  if (contiguous && positions[0] === 1) side = 'left';
  else if (contiguous && positions[count - 1] === lanes.length) side = 'right';
  else if (contiguous) side = 'middle';
  return { side, count, positions };
}
