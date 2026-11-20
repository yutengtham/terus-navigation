import type { ReactNode } from 'react';

type Props = { label: string; onClick: () => void; children: ReactNode; active?: boolean };

/** Round white floating button (layers, recenter). */
export function MapButton({ label, onClick, children, active }: Props) {
  return (
    <button className={`nn-map-button${active ? ' is-active' : ''}`} onClick={onClick} aria-label={label} title={label}>
      {children}
    </button>
  );
}
