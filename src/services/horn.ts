// Avatar "horn": a short sound made with Web Audio (no sound files). Plays only when stopped.
import type { AvatarPreset } from '../config/avatars';

let ctx: AudioContext | null = null;

export function playHorn(horn: AvatarPreset['horn']): void {
  try {
    ctx ??= new AudioContext();
    const t0 = ctx.currentTime;
    for (let i = 0; i < horn.repeat; i++) {
      const start = t0 + i * (horn.ms / 1000 + 0.08);
      const end = start + horn.ms / 1000;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = horn.wave;
      osc.frequency.setValueAtTime(horn.from, start);
      osc.frequency.linearRampToValueAtTime(horn.to, end);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  } catch {
    /* audio not available */
  }
}
