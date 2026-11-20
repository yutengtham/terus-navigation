// Official, free sources for route hazard alerts (no API key needed).
// Docs: https://developer.data.gov.my/realtime-api/weather and /realtime-api/flood-warning
// The API answers browser requests directly (CORS allowed, checked Nov 2026), so no proxy is used.
// Fair use: about 4 requests per minute per user - the caches below keep us far under that.

const BASE = 'https://api.data.gov.my';

export const HAZARD_ENDPOINTS = {
  /** MET Malaysia warnings (thunderstorms, heavy rain, strong winds...) */
  warnings: `${BASE}/weather/warning`,
  /** 7-day general forecast by state / district / town */
  forecast: `${BASE}/weather/forecast`,
  /** JPS river water level stations (the docs page omits the URL; this is the working one) */
  floodStations: `${BASE}/flood-warning`,
} as const;

/** Only the station columns we use, so the download stays small. */
export const FLOOD_STATION_FIELDS = [
  'station_id',
  'station_name',
  'latitude',
  'longitude',
  'district',
  'state',
  'water_level_indicator',
  'water_level_trend',
  'water_level_update_datetime',
] as const;

export const CACHE_MINUTES = {
  warnings: 10,
  floodStations: 10,
  forecast: 180,
} as const;

/** Give up on a slow request after this long (routing never waits for hazards). */
export const HAZARD_TIMEOUT_MS = 8000;

/**
 * River readings older than this are ignored. The data.gov.my flood feed stopped updating on
 * 23 Feb 2024 (checked 20 Nov 2026); old readings must never be shown as current.
 */
export const FLOOD_READING_MAX_AGE_H = 3;

/** Stations within this distance of the route count as "on the route". */
export const FLOOD_STATION_NEAR_KM = 3;

/** Route sample spacing for working out which districts the route passes. */
export const ROUTE_SAMPLE_KM = 2;

/** Refresh alerts this often during a trip. */
export const HAZARD_REFRESH_MIN = 10;

export const SOURCE_CREDIT =
  'Weather warnings & forecast: MET Malaysia. River levels: JPS. Both via data.gov.my. District boundaries: DOSM. ' +
  'Data and information are subject to the Malaysian Government Open Data Terms of Use 1.0.';
