import type { LngLat } from '../config/malaysia';
import type { Lane } from '../services/laneGuidance';

/** How you are travelling. Each uses its own Mapbox routing profile. */
export type TravelMode = 'driving' | 'walking' | 'cycling';

/** One instruction point, e.g. "turn right here". Comes from the Mapbox Directions API. */
export type Maneuver = {
  type: string; // turn, depart, arrive, roundabout, merge, off ramp, fork...
  modifier?: string; // right, left, slight right, sharp left, straight, uturn...
  exit?: number; // roundabout exit number
  instruction: string; // full English sentence from Mapbox
  location: LngLat;
};

/** A spoken instruction from Mapbox, e.g. "In 400 meters, turn right onto Jalan Tun Razak." */
export type VoiceInstruction = {
  /** Speak when this many metres are left until the END of the step it belongs to. */
  distanceBeforeEnd: number;
  text: string;
};

export type RouteStep = {
  distance: number; // metres
  duration: number; // seconds
  name: string; // road name
  /** Route number, e.g. "E1" or "E8" (from Mapbox, when known) */
  ref: string | null;
  maneuver: Maneuver;
  /** Spoken instructions for the maneuver at the end of this step (from Mapbox). */
  voice: VoiceInstruction[];
  /** Where the next maneuver leads, e.g. "Jalan Tun Razak" (from Mapbox banner instructions). */
  towards: string | null;
  /** Lanes for the maneuver at the END of this step, left to right (null = no lane data). */
  lanes: Lane[] | null;
  /** On a motorway / expressway (lanes are shown earlier: 1.5 km instead of 500 m). */
  highway: boolean;
};

export type NavRoute = {
  coordinates: LngLat[];
  distance: number; // metres
  duration: number; // seconds (Mapbox traffic-aware estimate)
  steps: RouteStep[];
  /** Main roads used, e.g. "E5, E6" or "Jalan Tun Razak" (from Mapbox). */
  summary: string;
  /** True if any part of the route is marked as a toll road in Mapbox data. */
  hasTolls: boolean;
  /** Toll plazas the route passes, in order (from Mapbox). Prices: see services/tollEstimate.ts */
  tollPlazas: TollPlaza[];
  /** Every junction where Mapbox lists the lanes (count + arrows), used by the map lane view. */
  laneJunctions: LaneJunction[];
  /** Driving only: traffic per line segment (coordinates[i] -> [i+1]): low / moderate / heavy / severe / unknown. */
  congestion?: string[];
  /** Driving only: posted speed limit per line segment in km/h (null = unknown). */
  maxspeedKmh?: (number | null)[];
};

/** Lanes on the approach to a junction (from steps[].intersections[].lanes). */
export type LaneJunction = {
  location: LngLat;
  lanes: Lane[];
};

/** A toll plaza on the route, e.g. { name: "Plaza Tol PJS 2", refs: ["E10"] }. */
export type TollPlaza = {
  name: string;
  /** Route numbers of the road at the plaza, e.g. ["E8", "2"] (may be empty) */
  refs: string[];
  location: LngLat;
};

/** Start or end of a trip. */
export type TripPoint = {
  name: string;
  coordinates: LngLat;
  /** true when this start point is your live GPS position -> real guidance is possible */
  isCurrentLocation?: boolean;
};
