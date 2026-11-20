import type { ManeuverIconKind } from '../services/maneuverText';

type Props = { kind: ManeuverIconKind; mirrored?: boolean; size?: number; color?: string };

/**
 * Big turn arrow for the instruction card (thick dark-green arrow from the reference image).
 * "left" turns are drawn by mirroring the "right" arrow.
 * The U-turn is drawn turning right, as U-turns do in Malaysia (left-hand traffic).
 */
export function ManeuverIcon({ kind, mirrored = false, size = 64, color = 'currentColor' }: Props) {
  const stroke = { stroke: color, strokeWidth: 7, fill: 'none', strokeLinejoin: 'round' as const };

  let shape: React.ReactNode;
  switch (kind) {
    case 'turn':
      shape = (
        <>
          <path d="M13 44V25c0-6 4-10 10-10h7" {...stroke} />
          <path d="M29 5l13 10-13 10z" fill={color} />
        </>
      );
      break;
    case 'slight':
      shape = (
        <>
          <path d="M17 44V29c0-3 1-5 3-7l9-9" {...stroke} />
          <path d="M23 7l15-2-2 15z" fill={color} />
        </>
      );
      break;
    case 'uturn':
      shape = (
        <>
          <path d="M13 44V20c0-12 21-12 21 0v8" {...stroke} />
          <path d="M25 26l9 14 9-14z" fill={color} />
        </>
      );
      break;
    case 'roundabout':
      shape = (
        <>
          <circle cx="24" cy="21" r="8" {...stroke} />
          <path d="M24 44V29" {...stroke} />
          <path d="M30 15l5-5" {...stroke} />
          <path d="M29 4h12v12z" fill={color} />
        </>
      );
      break;
    case 'arrive':
      shape = (
        <>
          <path d="M24 44s-13-13-13-23a13 13 0 0 1 26 0c0 10-13 23-13 23z" fill={color} />
          <circle cx="24" cy="21" r="5" fill="var(--nn-card-solid)" />
        </>
      );
      break;
    default:
      shape = (
        <>
          <path d="M24 44V16" {...stroke} />
          <path d="M14 17 24 4l10 13z" fill={color} />
        </>
      );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <g transform={mirrored ? 'translate(48 0) scale(-1 1)' : undefined}>{shape}</g>
    </svg>
  );
}
