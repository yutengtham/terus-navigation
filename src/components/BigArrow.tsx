import { useEffect, useRef } from 'react';
import type { ArrowTone } from '../services/arrowGuidance';

type Props = {
  /** Where to point, degrees: 0 = straight up (ahead), 90 = right, -90 = left */
  angle: number;
  tone: ArrowTone | 'idle';
};

/** Fill colours per tone (high contrast on the dark Arrow Mode background). */
const TONE_COLOURS: Record<Props['tone'], [string, string]> = {
  good: ['#5CF2B8', '#18C98B'], // Terus green
  near: ['#FFD27A', '#F5A524'], // amber
  wrong: ['#FF8A8F', '#F0444C'], // red
  idle: ['#8A97AA', '#5B6778'], // grey: no GPS / paused
};

// 60 tick marks around the ring, every 5th one longer.
const TICKS = Array.from({ length: 60 }, (_, i) => i);

/**
 * The big Arrow Mode pointer: a bold kite-shaped arrow inside a compass ring.
 * Rotation is eased every animation frame (not by React re-renders), so it stays smooth on
 * mid-range phones and never "spins the long way round" across 180°.
 */
export function BigArrow({ angle, tone }: Props) {
  const groupRef = useRef<SVGGElement>(null);
  const targetRef = useRef(angle);
  const currentRef = useRef(angle);

  useEffect(() => {
    targetRef.current = angle;
  }, [angle]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const diff = ((targetRef.current - currentRef.current + 540) % 360) - 180; // shortest way round
      currentRef.current += diff * Math.min(1, dt * 8); // ~0.12 s to catch up
      groupRef.current?.setAttribute('transform', `rotate(${currentRef.current.toFixed(2)} 160 160)`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const [light, dark] = TONE_COLOURS[tone];

  return (
    <svg className={`nn-bigarrow nn-bigarrow--${tone}`} viewBox="0 0 320 320" role="img" aria-hidden="true">
      <defs>
        <linearGradient id="nn-arrow-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: light, transition: 'stop-color 0.35s' }} />
          <stop offset="100%" style={{ stopColor: dark, transition: 'stop-color 0.35s' }} />
        </linearGradient>
        <radialGradient id="nn-arrow-glow">
          <stop offset="0%" stopOpacity="0.35" style={{ stopColor: dark, transition: 'stop-color 0.35s' }} />
          <stop offset="70%" stopOpacity="0" style={{ stopColor: dark }} />
        </radialGradient>
      </defs>

      {/* soft glow in the tone colour */}
      <circle cx="160" cy="160" r="150" fill="url(#nn-arrow-glow)" />
      {/* compass ring */}
      <circle cx="160" cy="160" r="138" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="2" />
      {TICKS.map((i) => (
        <line
          key={i}
          x1="160"
          y1={i % 5 === 0 ? 26 : 30}
          x2="160"
          y2="36"
          stroke={i % 5 === 0 ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.12)'}
          strokeWidth={i % 5 === 0 ? 2.5 : 1.5}
          strokeLinecap="round"
          transform={`rotate(${i * 6} 160 160)`}
        />
      ))}
      {/* fixed "ahead" marker at the top of the ring */}
      <path d="M160 8 l9 12 h-18 Z" fill="rgba(255,255,255,0.55)" />

      {/* the arrow (rotated) */}
      <g ref={groupRef} transform={`rotate(${angle} 160 160)`}>
        <path
          d="M160 58 L236 236 Q240 247 229 243 L160 212 L91 243 Q80 247 84 236 Z"
          fill="url(#nn-arrow-fill)"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        {/* centre ridge for a little depth */}
        <path d="M160 70 L160 206" stroke="rgba(255,255,255,0.28)" strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
  );
}
