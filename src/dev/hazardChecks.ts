import type { LngLat } from '../config/malaysia';
import { normaliseArea, parseWarningAreas, sameArea, stateKey } from '../services/areaNames';
import { parseFloodStations, parseWarnings, type FloodStation } from '../services/dataGovMy';
import {
  activeInWindow,
  buildHazards,
  districtAt,
  floodAvoidPoints,
  isFresh,
  loadDistricts,
  sampleRoute,
  segmentFor,
  stationHazards,
} from '../services/routeHazards';
import { measureLine, pointAlong } from '../utils/geo';
import type { CheckResult } from './navChecks';
import { SAMPLE_STATIONS, SAMPLE_WARNINGS } from './sampleHazards';

/*
 * Checks for routeHazards.ts using saved real data.gov.my responses (sampleHazards.ts):
 * name normalisation, warning area parsing, time windows, station distance and segments.
 * Async because the district boundaries load on demand.
 */
export async function runHazardChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const check = (name: string, pass: boolean, detail = '') => results.push({ name: `Hazards: ${name}`, pass, detail });

  // --- Names ---
  check(
    'W.P. Kuala Lumpur = WILAYAH PERSEKUTUAN KUALA LUMPUR = Kuala Lumpur',
    stateKey('W.P. Kuala Lumpur') === 'kuala lumpur' && stateKey('WILAYAH PERSEKUTUAN KUALA LUMPUR') === 'kuala lumpur' && stateKey('Kuala Lumpur') === 'kuala lumpur',
  );
  check('Ulu Langat = Hulu Langat; "Gombak (WPKL)" = Gombak', sameArea('Ulu Langat', 'Hulu Langat') && normaliseArea('Gombak (WPKL)') === 'gombak');
  check('"Timur Laut Pulau Pinang" (JPS) = "Timur Laut" (DOSM); Penang = Pulau Pinang', sameArea('Timur Laut Pulau Pinang', 'Timur Laut') && stateKey('Penang') === 'pulau pinang');
  check('Different places do not match (Klang vs Kuala Langat)', !sameArea('Klang', 'Kuala Langat'));

  // --- Warning parsing (real text) ---
  const warnings = parseWarnings(SAMPLE_WARNINGS);
  check('Real warnings parse (3 records, times get +08:00)', warnings.length === 3 && warnings[0].validTo === '2026-11-20T18:00:00+08:00', `${warnings.length}`);
  const areasEn = parseWarningAreas(warnings[0].textEn);
  const sel = areasEn.find((a) => a.state === 'selangor');
  const kl = areasEn.find((a) => a.state === 'kuala lumpur');
  const sabah = areasEn.find((a) => a.state === 'sabah');
  check('English: Selangor (Klang, Petaling, Kuala Selangor, Gombak)', sel?.places.join('|') === 'Klang|Petaling|Kuala Selangor|Gombak', JSON.stringify(sel));
  check('English: W.P. Kuala Lumpur = whole state', !!kl && kl.places.length === 0, JSON.stringify(kl));
  check('English: Sabah "West Coast" expands to its districts', !!sabah && sabah.places.includes('Kota Kinabalu') && sabah.places.includes('Lahad Datu'), JSON.stringify(sabah?.places));
  check('English: all 7 states found', areasEn.length === 7, areasEn.map((a) => a.state).join(', '));
  const areasMs = parseWarningAreas(warnings[0].textMs);
  check('Malay text gives the same states', areasMs.map((a) => a.state).join() === areasEn.map((a) => a.state).join(), areasMs.map((a) => a.state).join(', '));
  check('Marine warning ("over the waters of...") matches no land areas', parseWarningAreas(warnings[1].textEn).length === 0 && parseWarningAreas(warnings[1].textMs).length === 0);

  // --- Time windows ---
  const now = Date.parse('2026-11-20T15:00:00+08:00');
  check('Active now (2-6 PM, checked 3 PM)', activeInWindow('2026-11-20T14:00:00+08:00', '2026-11-20T18:00:00+08:00', '', now, now + 1800_000));
  check('Expired (ended 2:30 PM) is dropped', !activeInWindow('2026-11-20T12:00:00+08:00', '2026-11-20T14:30:00+08:00', '', now, now + 1800_000));
  check('Starts 3:20 PM, trip ends 3:30 PM: included', activeInWindow('2026-11-20T15:20:00+08:00', null, '2026-11-20T15:00:00+08:00', now, now + 1800_000));
  check('Starts 5 PM, trip ends 3:30 PM: dropped', !activeInWindow('2026-11-20T17:00:00+08:00', null, '2026-11-20T15:00:00+08:00', now, now + 1800_000));

  // --- Districts + route (Bangsar, KL -> Damansara Utama, Petaling) ---
  const districts = await loadDistricts();
  check('District boundaries load (160 districts)', districts.length === 160, `${districts.length}`);
  check('Bangsar is in W.P. Kuala Lumpur', districtAt([101.679, 3.13], districts)?.name === 'W.P. Kuala Lumpur', districtAt([101.679, 3.13], districts)?.name ?? 'none');
  check('Damansara Utama is in Petaling, Selangor', districtAt([101.62, 3.136], districts)?.name === 'Petaling');
  const coords: LngLat[] = [
    [101.679, 3.13],
    [101.66, 3.128],
    [101.64, 3.134],
    [101.62, 3.136],
  ];
  const line = measureLine(coords);
  const samples = sampleRoute(line, districts);
  check('Route sampled every 2 km (+ end point)', samples.length === Math.ceil(line.length / 2000) + 1, `${samples.length} samples over ${(line.length / 1000).toFixed(1)} km`);

  const real = buildHazards({ line, samples, warnings, stations: [], now, etaSeconds: 1200 });
  check(
    'Real thunderstorm warning matches the whole KL -> Petaling route, once',
    real.hazards.length === 1 && real.hazards[0].type === 'thunderstorm' && real.hazards[0].segment.startKm === 0 && Math.abs(real.hazards[0].segment.endKm - line.length / 1000) < 0.01,
    JSON.stringify(real.hazards.map((h) => [h.type, h.segment, h.affectedArea])),
  );
  check('Hazard says where it comes from + issue time', real.hazards[0]?.source === 'MET Malaysia' && real.hazards[0]?.issuedAt === '2026-11-20T14:45:00+08:00');

  // --- Segments ---
  const seg = segmentFor([samples[1], samples[2]], line.length / 1000);
  check('Segment = first..last matching sample, padded 1 km each side', seg.startKm === 1 && seg.endKm === Math.min(line.length / 1000, 5), JSON.stringify(seg));

  // --- Stations ---
  const stations = parseFloodStations(SAMPLE_STATIONS);
  check('Real stations parse (2)', stations.length === 2 && stations[0].lat === 3.214139 && stations[0].level === 'NORMAL');
  check('Feb 2024 readings are too old to use', !isFresh(stations[1].updatedAt, now));
  const fresh = (p: LngLat, level: FloodStation['level'], id: string): FloodStation => ({
    id, name: id, lat: p[1], lng: p[0], district: 'Petaling', state: 'SELANGOR', level, trend: 'RISING', updatedAt: '2026-11-20T14:30:00+08:00',
  });
  const mid = pointAlong(line, line.length / 2);
  const oneKmOff: LngLat = [mid[0], mid[1] + 1000 / 110574];
  const fourKmOff: LngLat = [mid[0], mid[1] + 4000 / 110574];
  const matches = stationHazards([fresh(oneKmOff, 'DANGER', 'near'), fresh(fourKmOff, 'DANGER', 'far'), fresh(mid, 'NORMAL', 'normal')], line, samples, now);
  check('Station 1 km from route flagged; 4 km away and NORMAL ones ignored', matches.length === 1 && matches[0].hazard.id === 'jps:near', matches.map((m) => m.hazard.id).join(', '));
  check('Station distance ~1 km and segment +-1 km around it', Math.abs(matches[0].offsetM - 1000) < 60 && Math.abs(matches[0].hazard.segment.endKm - matches[0].hazard.segment.startKm - 2) < 0.01, `${matches[0]?.offsetM.toFixed(0)} m`);
  const onRoute = buildHazards({ line, samples, warnings: [], stations: [fresh(mid, 'DANGER', 'on')], now, etaSeconds: 1200 });
  check('Station on the route at DANGER -> "flood alert on route"', onRoute.floodOnRoute && onRoute.hazards[0]?.severity === 'danger');
  const nearOnly = buildHazards({ line, samples, warnings: [], stations: [fresh(oneKmOff, 'DANGER', 'near')], now, etaSeconds: 1200 });
  check('Station 1 km away -> shown as "near", not "on route"', !nearOnly.floodOnRoute && nearOnly.hazards.length === 1);
  check('Avoid points: the flood spot + 300 m either side', floodAvoidPoints(onRoute.hazards, line).length === 3);

  return results;
}
