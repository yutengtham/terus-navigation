// ?demo=flood: fake official data so the hazard banner, map colouring, voice alerts and
// "Avoid flood areas" can be shown reliably at a presentation, whatever the real weather is.
// The fakes go through the same matching code as real data, and every one is labelled DEMO.

import type { LngLat } from '../config/malaysia';
import { measureLine, pointAlong } from '../utils/geo';
import type { FloodStation, MetWarning } from './dataGovMy';
import { districtAt, loadDistricts, type DemoData } from './routeHazards';

/** Fixed per trip, so a rerouted / "avoid floods" route is checked against the SAME fake flood spot. */
let anchor: { key: string; data: DemoData } | null = null;

const tripKey = (from: LngLat, to: LngLat) => [...from, ...to].map((v) => v.toFixed(3)).join(',');

function myIso(ms: number): string {
  // Malaysia time without zone suffix is how data.gov.my writes it; we store ISO with +08:00.
  const d = new Date(ms + 8 * 3600_000).toISOString().slice(0, 19);
  return `${d}+08:00`;
}

/**
 * Builds (once per trip) a fake JPS river station at DANGER level ~65% along the first route,
 * and a fake MET thunderstorm warning for the district ~30% along it.
 */
export async function demoHazardData(coords: LngLat[], now = Date.now()): Promise<DemoData> {
  const from = coords[0];
  const to = coords[coords.length - 1];
  const key = tripKey(from, to);
  if (anchor?.key === key) return anchor.data;
  const line = measureLine(coords);
  const stationAt = pointAlong(line, line.length * 0.65);
  const stormAt = pointAlong(line, line.length * 0.3);
  const district = districtAt(stormAt, await loadDistricts());
  const stateText = district ? district.stateLabel : 'Kuala Lumpur';
  const place = district && !district.name.startsWith('W.P.') ? `${stateText}: ${district.name}` : stateText;
  const until = new Date(now + 3 * 3600_000);
  const untilText = until.toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' });
  const warning: MetWarning = {
    issued: myIso(now - 20 * 60_000),
    titleEn: 'Thunderstorm Warning (DEMO)',
    titleMs: 'Amaran Ribut Petir (DEMO)',
    validFrom: myIso(now - 20 * 60_000),
    validTo: myIso(until.getTime()),
    headingEn: 'THUNDERSTORMS WARNING (DEMO)',
    headingMs: 'AMARAN RIBUT PETIR (DEMO)',
    textEn: `Thunderstorms, heavy rain and strong winds are expected over the states of ${place} until ${untilText}.`,
    textMs: '',
    instructionEn: 'Demo data for presentations - not a real warning.',
    instructionMs: '',
    demo: true,
  };
  const station: FloodStation = {
    id: 'DEMO-1',
    name: 'Sg. Contoh',
    lat: stationAt[1],
    lng: stationAt[0],
    district: district?.name ?? '',
    state: district?.state.toUpperCase() ?? '',
    level: 'DANGER',
    trend: 'RISING',
    updatedAt: myIso(now - 10 * 60_000),
    demo: true,
  };
  anchor = { key, data: { warnings: [warning], stations: [station] } };
  return anchor.data;
}
