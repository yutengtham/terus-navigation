import { useEffect, useRef } from 'react';
import { lanesAreInformative } from '../services/laneGuidance';
import { computeProgress, type PreparedRoute } from '../services/routeProgress';
import { eventForManeuver, maybeJoke } from '../services/voiceJokes';
import { speak, stopSpeaking } from '../services/voiceService';

/**
 * Metres from `traveled` until the next Mapbox voice instruction is due (Infinity if none).
 * Used to keep personality jokes away from instructions that come close together.
 */
export function distanceToNextInstruction(prepared: PreparedRoute, traveled: number): number {
  const steps = prepared.route.steps;
  for (let i = computeProgress(prepared, traveled).stepIndex; i < steps.length; i++) {
    const start = i === 0 ? 0 : prepared.stepEnds[i - 1];
    const len = prepared.stepEnds[i] - start;
    const scale = steps[i].distance > 0 ? len / steps[i].distance : 1;
    for (const v of steps[i].voice) {
      const at = prepared.stepEnds[i] - v.distanceBeforeEnd * scale;
      if (at > traveled + 5) return at - traveled;
    }
  }
  return Infinity;
}

/**
 * Speaks Mapbox's voice instructions at the right moment.
 * Each step carries instructions like "In 400 meters, turn right..." with the distance
 * (before the end of the step) at which to say them. We speak each one once, as soon as
 * the remaining distance in the step drops below its trigger distance.
 */
export function useVoiceGuidance(prepared: PreparedRoute | null, traveled: number | null, enabled: boolean): void {
  const spoken = useRef(new Set<string>());

  // A new route (start or reroute) starts with a clean slate.
  useEffect(() => {
    spoken.current = new Set();
  }, [prepared]);

  // Muting stops anything currently being said.
  useEffect(() => {
    if (!enabled) stopSpeaking();
  }, [enabled]);

  useEffect(() => () => stopSpeaking(), []);

  useEffect(() => {
    if (!prepared || traveled == null) return;
    const { stepIndex } = computeProgress(prepared, traveled);
    const step = prepared.route.steps[stepIndex];
    if (!step) return;

    // stepEnds are measured on the drawn line; Mapbox step lengths differ slightly, so scale.
    const stepStart = stepIndex === 0 ? 0 : prepared.stepEnds[stepIndex - 1];
    const stepLength = prepared.stepEnds[stepIndex] - stepStart;
    const scale = step.distance > 0 ? stepLength / step.distance : 1;
    const left = prepared.stepEnds[stepIndex] - traveled;

    // Instructions are listed far-to-near. Find the nearest one already due.
    let due: { key: string; text: string } | null = null;
    step.voice.forEach((v, i) => {
      const key = `${stepIndex}:${i}`;
      if (left <= v.distanceBeforeEnd * scale + 5 && !spoken.current.has(key)) {
        due = { key, text: v.text };
        // Skip older ones we drove past without saying (e.g. right after a reroute).
        for (let j = 0; j < i; j++) spoken.current.add(`${stepIndex}:${j}`);
      }
    });
    if (due) {
      const { key, text } = due as { key: string; text: string };
      spoken.current.add(key);
      // 1) The real instruction, always first and in full (interrupts anything older, jokes included).
      if (enabled) speak(text, { interrupt: true });
      // 2) Maybe a short personality tag after it - only far from the maneuver, at simple
      //    junctions, with the next instruction well away, and at most once per 2 minutes.
      const first = stepIndex === 0 && key === '0:0' && traveled < 80;
      const next = prepared.route.steps[stepIndex + 1]?.maneuver;
      const event = first ? 'trip_start' : eventForManeuver(next);
      if (event) {
        maybeJoke(
          {
            event,
            // Arriving has no driving action after it, so the 100 m rule doesn't apply.
            toManeuverM: event === 'arrive' ? Infinity : left,
            toNextInstructionM: distanceToNextInstruction(prepared, traveled),
            complex: lanesAreInformative(step.lanes),
          },
          enabled,
        );
      }
    }
  }, [prepared, traveled, enabled]);
}
