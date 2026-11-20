// Voice personality jokes. SAFETY FIRST: the real instruction is always spoken first and in
// full by the normal guidance; a joke is only an optional short tag AFTER it, and only when:
//  - a personality other than Standard is chosen,
//  - it is not a flood / hazard alert,
//  - the maneuver is at least 100 m away and the junction is not complex,
//  - the next instruction is at least 300 m away (two instructions never get squeezed),
//  - no joke in the last 2 minutes, and never the same line twice in a row.

import {
  PERSONALITIES,
  VOICE_CLIPS,
  type PersonalityId,
  type VoiceEvent,
} from '../config/data/voicePersonalities';
import type { Maneuver } from '../models/route';
import { speak } from './voiceService';

export const JOKE_GAP_MS = 120_000;
export const NO_JOKE_WITHIN_M = 100;
export const MIN_GAP_TO_NEXT_M = 300;

export type JokeState = { lastJokeAt: number; lastLineId: string | null };

export type JokeContext = {
  personality: PersonalityId;
  event: VoiceEvent;
  now: number;
  /** Metres from here to the maneuver the instruction is about (Infinity if none, e.g. toll / jam) */
  toManeuverM: number;
  /** Metres until the next spoken instruction (Infinity if none) */
  toNextInstructionM: number;
  /** Multi-lane junction / lane choice - plain instruction only */
  complex: boolean;
};

export type JokeLine = { id: string; text: string };

/** Pure decision (also used by the dev checks). `random` returns 0..1. */
export function pickJoke(state: JokeState, ctx: JokeContext, random: () => number = Math.random): JokeLine | null {
  if (ctx.personality === 'standard' || ctx.event === 'flood_alert') return null;
  if (ctx.complex) return null;
  if (ctx.toManeuverM < NO_JOKE_WITHIN_M) return null;
  if (ctx.toNextInstructionM < MIN_GAP_TO_NEXT_M) return null;
  if (ctx.now - state.lastJokeAt < JOKE_GAP_MS) return null;
  const bank = PERSONALITIES[ctx.personality].lines[ctx.event] ?? [];
  const options = bank.map((text, i) => ({ id: `${ctx.personality}.${ctx.event}.${i}`, text })).filter((l) => l.id !== state.lastLineId);
  if (!options.length) return null;
  return options[Math.min(options.length - 1, Math.floor(random() * options.length))];
}

/** Which joke bank fits a Mapbox maneuver. */
export function eventForManeuver(m: Maneuver | undefined): VoiceEvent | null {
  if (!m) return null;
  const mod = m.modifier ?? '';
  if (m.type === 'arrive') return 'arrive';
  if (m.type === 'depart') return 'trip_start';
  if (/roundabout|rotary/.test(m.type)) return 'roundabout';
  if (mod === 'uturn') return 'uturn';
  if (m.type === 'off ramp' || m.type === 'exit roundabout') return 'exit';
  if (m.type === 'fork' || m.type === 'merge' || m.type === 'on ramp') return mod.includes('left') ? 'keep_left' : mod.includes('right') ? 'keep_right' : null;
  if (mod.includes('left')) return 'turn_left';
  if (mod.includes('right')) return 'turn_right';
  return null;
}

// ---- The live engine (one per app; reset when a trip starts) ----

let personality: PersonalityId = 'standard';
let state: JokeState = { lastJokeAt: -Infinity, lastLineId: null };

export function setPersonality(id: PersonalityId): void {
  personality = id;
}
export function getPersonality(): PersonalityId {
  return personality;
}
export function resetJokes(): void {
  state = { lastJokeAt: -Infinity, lastLineId: null };
}

/** Says one line in the personality's voice (or plays its recorded clip if one exists). Queued, never interrupts. */
export function sayLine(p: PersonalityId, line: JokeLine): void {
  const clip = VOICE_CLIPS[line.id];
  if (clip) {
    // Recorded clip: wait for any speech in progress (the instruction) to finish first.
    const play = () => void new Audio(clip).play().catch(() => {});
    if (window.speechSynthesis?.speaking) {
      const t = window.setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          window.clearInterval(t);
          play();
        }
      }, 150);
    } else play();
    return;
  }
  const v = PERSONALITIES[p].voice;
  speak(line.text, { lang: v.lang, pitch: v.pitch, rate: v.rate });
}

/**
 * Call right AFTER speaking the plain instruction (or event): maybe adds a joke tag.
 * Returns the line said (for testing / logging), or null.
 */
export function maybeJoke(ctx: Omit<JokeContext, 'personality' | 'now'>, voiceOn: boolean): JokeLine | null {
  if (!voiceOn) return null;
  const line = pickJoke(state, { ...ctx, personality, now: Date.now() });
  if (!line) return null;
  state = { lastJokeAt: Date.now(), lastLineId: line.id };
  sayLine(personality, line);
  return line;
}
