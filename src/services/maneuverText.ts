import type { Maneuver } from '../models/route';

/** Short headline for the instruction card, e.g. "Turn right". */
export function maneuverTitle(m: Maneuver | null): string {
  if (!m) return 'Continue';
  const mod = m.modifier ?? '';
  const side = mod.includes('left') ? 'left' : mod.includes('right') ? 'right' : '';

  switch (m.type) {
    case 'arrive':
      return 'Arrive at destination';
    case 'depart':
      return 'Head out';
    case 'roundabout':
    case 'rotary':
      return m.exit ? `Roundabout, exit ${m.exit}` : 'Enter the roundabout';
    case 'roundabout turn':
      return side ? `At roundabout, turn ${side}` : 'Continue at roundabout';
    case 'off ramp':
      return side ? `Take exit ${side}` : 'Take the exit';
    case 'on ramp':
      return 'Take the ramp';
    case 'merge':
      return side ? `Merge ${side}` : 'Merge';
    case 'fork':
      return side ? `Keep ${side}` : 'Keep straight';
  }

  if (mod === 'uturn') return 'Make a U-turn';
  if (mod === 'straight') return 'Continue straight';
  if (mod.startsWith('slight')) return `Bear ${side}`;
  if (mod.startsWith('sharp')) return `Sharp ${side}`;
  if (side) return `Turn ${side}`;
  return 'Continue';
}

export type ManeuverIconKind = 'turn' | 'slight' | 'straight' | 'uturn' | 'roundabout' | 'arrive';

/** Which arrow to draw, and whether to mirror it for "left". */
export function maneuverIcon(m: Maneuver | null): { kind: ManeuverIconKind; mirrored: boolean } {
  if (!m) return { kind: 'straight', mirrored: false };
  const mod = m.modifier ?? '';
  const mirrored = mod.includes('left');

  if (m.type === 'arrive') return { kind: 'arrive', mirrored: false };
  if (m.type === 'roundabout' || m.type === 'rotary' || m.type === 'roundabout turn') {
    return { kind: 'roundabout', mirrored: false };
  }
  if (mod === 'uturn') return { kind: 'uturn', mirrored: false };
  if (mod === 'straight' || !mod) return { kind: 'straight', mirrored: false };
  if (mod.startsWith('slight') || ['fork', 'merge', 'off ramp', 'on ramp'].includes(m.type)) {
    return { kind: 'slight', mirrored };
  }
  return { kind: 'turn', mirrored };
}
