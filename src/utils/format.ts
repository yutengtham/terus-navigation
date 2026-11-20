import { MALAYSIA } from '../config/malaysia';

/**
 * Display units, set once by the app from Settings. Kept here (rather than passed to every
 * component) because every screen that shows a distance re-renders when settings change.
 */
let units: 'metric' | 'imperial' = 'metric';
export function setDisplayUnits(u: 'metric' | 'imperial'): void {
  units = u;
}
export function getDisplayUnits(): 'metric' | 'imperial' {
  return units;
}

/** 340 -> "340 m", 5830 -> "5.8 km" (Malaysia uses metric); imperial: "350 ft", "3.6 mi". */
export function formatDistance(meters: number): string {
  if (units === 'imperial') {
    const miles = meters / 1609.344;
    if (miles < 0.1) return `${Math.max(0, Math.round((meters * 3.28084) / 50) * 50)} ft`;
    return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
  }
  if (meters < 1000) {
    const step = meters < 100 ? 10 : 50;
    return `${Math.max(0, Math.round(meters / step) * step)} m`;
  }
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/** 720 -> "12 min", 4500 -> "1 h 15 min" */
export function formatDuration(seconds: number): string {
  const totalMin = Math.max(1, Math.round(seconds / 60));
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Clock time in Malaysia time, e.g. "9:53 AM". */
export function formatClock(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: MALAYSIA.timeZone,
  }).format(date);
}
