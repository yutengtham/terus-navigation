import { PERSONALITIES, PERSONALITY_IDS, type VoiceEvent } from '../config/data/voicePersonalities';
import { jamMetres } from '../hooks/usePersonalityEvents';
import { eventForManeuver, JOKE_GAP_MS, pickJoke, type JokeContext, type JokeState } from '../services/voiceJokes';
import type { CheckResult } from './navChecks';

const EVENTS: VoiceEvent[] = ['turn_left', 'turn_right', 'keep_left', 'keep_right', 'uturn', 'exit', 'roundabout', 'arrive', 'reroute', 'traffic_jam', 'toll_ahead', 'flood_alert', 'speeding', 'long_straight', 'trip_start'];

/** Voice personality checks: safety rules, rate limit, no repeats, phrase bank coverage. */
export function runVoiceChecks(): CheckResult[] {
  const results: CheckResult[] = [];
  const check = (name: string, pass: boolean, detail = '') => results.push({ name: `Voice: ${name}`, pass, detail });
  const fresh: JokeState = { lastJokeAt: -Infinity, lastLineId: null };
  const ok: JokeContext = { personality: 'makcik', event: 'turn_left', now: 1_000_000, toManeuverM: 400, toNextInstructionM: 600, complex: false };

  check('Mak Cik, 400 m before a simple left turn: a joke is allowed', pickJoke(fresh, ok) !== null);
  check('Standard personality never jokes', pickJoke(fresh, { ...ok, personality: 'standard' }) === null);
  check(
    'Flood alerts never get a joke (any personality)',
    PERSONALITY_IDS.every((p) => pickJoke(fresh, { ...ok, personality: p, event: 'flood_alert' }) === null) && PERSONALITY_IDS.every((p) => (PERSONALITIES[p].lines.flood_alert ?? []).length === 0),
  );
  check('No joke within 100 m of the maneuver (90 m)', pickJoke(fresh, { ...ok, toManeuverM: 90 }) === null);
  check('Joke allowed at 150 m', pickJoke(fresh, { ...ok, toManeuverM: 150 }) !== null);
  check('No joke when the next instruction is under 300 m away', pickJoke(fresh, { ...ok, toNextInstructionM: 250 }) === null);
  check('No joke at complex (multi-lane) junctions', pickJoke(fresh, { ...ok, complex: true }) === null);

  const said: JokeState = { lastJokeAt: ok.now, lastLineId: 'makcik.turn_left.0' };
  check('Rate limit: nothing 60 s after a joke', pickJoke(said, { ...ok, now: ok.now + 60_000 }) === null);
  check('Rate limit: allowed again after 2 minutes', pickJoke(said, { ...ok, now: ok.now + JOKE_GAP_MS + 1 }) !== null);

  // Never the same line twice in a row, even when the random pick would choose it.
  let state = fresh;
  let repeat = false;
  for (let k = 0; k < 300; k++) {
    const now = ok.now + k * (JOKE_GAP_MS + 1);
    const line = pickJoke(state, { ...ok, now }, () => (k % 7) / 7);
    if (!line) continue;
    if (line.id === state.lastLineId) repeat = true;
    state = { lastJokeAt: now, lastLineId: line.id };
  }
  check('Never the same line twice in a row (300 picks)', !repeat);
  const forced = pickJoke({ lastJokeAt: -Infinity, lastLineId: 'makcik.turn_left.0' }, ok, () => 0);
  check('A forced pick of the last line chooses a different one', forced !== null && forced.id !== 'makcik.turn_left.0', forced?.id ?? 'none');

  // Phrase banks: 4-6 lines for every event (except flood), short enough to be a quick tag.
  const gaps: string[] = [];
  let longest = '';
  for (const p of PERSONALITY_IDS) {
    if (p === 'standard') continue;
    for (const e of EVENTS) {
      if (e === 'flood_alert') continue;
      const n = PERSONALITIES[p].lines[e]?.length ?? 0;
      if (n < 4 || n > 6) gaps.push(`${p}.${e}=${n}`);
      for (const l of PERSONALITIES[p].lines[e] ?? []) if (l.length > longest.length) longest = l;
    }
  }
  check('Every personality has 4-6 lines for every event', gaps.length === 0, gaps.join(', '));
  check('Lines stay short (max 70 characters)', longest.length <= 70, `${longest.length}: ${longest}`);

  // Mapping Mapbox maneuvers to joke events
  const m = (type: string, modifier?: string) => eventForManeuver({ type, modifier, instruction: '', location: [0, 0] });
  check(
    'Maneuvers map to the right events',
    m('turn', 'left') === 'turn_left' && m('turn', 'sharp right') === 'turn_right' && m('fork', 'slight left') === 'keep_left' && m('off ramp', 'right') === 'exit' && m('roundabout', 'right') === 'roundabout' && m('turn', 'uturn') === 'uturn' && m('arrive') === 'arrive' && m('continue', 'straight') === null,
  );

  // Traffic jam measurement from Mapbox congestion
  const cum = [0, 200, 400, 600, 800, 1000];
  check('Heavy traffic metres counted ahead', jamMetres(cum, ['low', 'heavy', 'severe', 'moderate', 'heavy'], 100, 900) === 500, `${jamMetres(cum, ['low', 'heavy', 'severe', 'moderate', 'heavy'], 100, 900)}`);
  return results;
}
