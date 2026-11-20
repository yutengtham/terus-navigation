// Official weather / flood alerts that touch the user's route.
// Terus never predicts floods itself: every hazard comes from an official source and says which one.

export type HazardType = 'flood' | 'heavy_rain' | 'thunderstorm' | 'wind' | 'other';
export type HazardSeverity = 'advisory' | 'warning' | 'danger';
export type HazardSource = 'MET Malaysia' | 'JPS / data.gov.my';

/** Title in each app language; `en` is always there, others when the source gives them. */
export type HazardTitle = { en: string; ms?: string; zh?: string };

export type RouteHazard = {
  /** Stable id (source + issue time + area) so voice alerts fire once per hazard. */
  id: string;
  type: HazardType;
  severity: HazardSeverity;
  title: HazardTitle;
  source: HazardSource;
  /** ISO time the source issued / measured it */
  issuedAt: string;
  /** ISO time it ends; null when the source doesn't say (river levels) */
  validUntil: string | null;
  /** Human-readable place, e.g. "Petaling, Selangor" or "Sg. Klang di Masjid Jamek" */
  affectedArea: string;
  /** First route point affected, km from the route start */
  distanceAlongRouteKm: number;
  /** Stretch of the route affected, km from the route start */
  segment: { startKm: number; endKm: number };
  /** River station position (flood only), for "Avoid flood areas" */
  location?: [number, number];
  /** Extra detail for the sheet (water level trend, instructions) */
  detail?: string;
  /** True for ?demo=flood fake alerts, shown with a DEMO label */
  demo?: boolean;
};

/** Destination weather from the 7-day forecast (Malay text, as published). */
export type DestinationForecast = {
  locationName: string;
  date: string;
  morning: string;
  afternoon: string;
  night: string;
  summary: string;
  summaryWhen: string;
  minTemp: number | null;
  maxTemp: number | null;
};

/** Everything the screens need from one hazard check. */
export type HazardReport = {
  hazards: RouteHazard[];
  /** When the official data was fetched (for "updated 2:41 PM") */
  checkedAt: number;
  /** Notes for the details sheet, e.g. "JPS river data last updated 23 Feb 2024 - not used" */
  notes: string[];
};
