import type { LngLat } from '../config/malaysia';

export type ReportType = 'pothole' | 'roadblock' | 'flooded' | 'accident' | 'traffic_light' | 'other';

/** A road hazard the user reported. Stored on this device for now (see ReportsRepository). */
export type RoadReport = {
  id: string;
  type: ReportType;
  /** ms since 1970 */
  createdAt: number;
  /** Where it is (snapped to the route while navigating) */
  location: LngLat;
  /** Road name from the route or OSM reverse geocoding; '' if unknown */
  roadName: string;
  note: string;
  /** Resized photo (max 1080 px), optional */
  photo: Blob | null;
  /** Poster "danger level" 1-5 (user can change it) */
  danger: number;
  /** Which funny line / reward line the poster shows (changes with "Regenerate") */
  lineSeed: number;
  /** Sample report from ?demo=fun */
  demo?: boolean;
};
