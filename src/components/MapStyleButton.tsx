import { useState } from 'react';
import type { Settings } from '../hooks/useSettings';
import { MapButton } from './MapButton';
import { LayersIcon } from './icons';

type Props = {
  mapView: Settings['mapView'];
  appearance: Settings['appearance'];
  onChange: (changes: Partial<Pick<Settings, 'mapView' | 'appearance'>>) => void;
};

/** Layers button: opens a small menu to switch 3D / 2D and day / night. */
export function MapStyleButton({ mapView, appearance, onChange }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="nn-style-menu-anchor">
      <MapButton label="Map style" onClick={() => setOpen((o) => !o)} active={open}>
        <LayersIcon />
      </MapButton>
      {open && (
        <div className="nn-card nn-style-menu" role="menu">
          <div className="nn-style-menu__label">Map view</div>
          <div className="nn-segmented">
            {(['3d', '2d'] as const).map((v) => (
              <button key={v} className={mapView === v ? 'is-active' : ''} onClick={() => onChange({ mapView: v })}>
                {v.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="nn-style-menu__label">Light</div>
          <div className="nn-segmented">
            {(
              [
                ['auto', 'Auto'],
                ['day', 'Day'],
                ['night', 'Night'],
              ] as const
            ).map(([v, label]) => (
              <button key={v} className={appearance === v ? 'is-active' : ''} onClick={() => onChange({ appearance: v })}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
