import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { groupById, hotlinesForRoad, type Hotline, type HotlineGroup } from '../config/emergencyContacts';
import type { GpsFix } from '../services/locationService';
import { BackIcon, CloseIcon, PhoneIcon } from './icons';

type Props = {
  /** Your live GPS position, so you can read it out or send it to the operator. */
  fix: GpsFix | null;
  /** Road you are on during navigation, e.g. "Lebuhraya Utara–Selatan E1" */
  roadName?: string | null;
  /** Extra CSS class to position the button on each screen */
  className?: string;
};

type Page = 'menu' | 'sos' | HotlineGroup['id'];

/**
 * Red SOS button that opens a "Talian hotline" panel in the style of LLM's TuJu app:
 * a big SOS Lebuhraya tile, then Talian LLM / Insurans / Lebuhraya / Kecemasan tiles.
 * Tapping a number opens the phone's own dialler - the call is only made when the user presses call there.
 */
export function SosButton({ fix, roadName, className }: Props) {
  const [page, setPage] = useState<Page | null>(null);

  return (
    <>
      <button className={`nn-sos-button ${className ?? ''}`} onClick={() => setPage('menu')} aria-label="SOS emergency hotlines">
        SOS
      </button>

      {page &&
        // Rendered at the top of the page so it covers the whole screen, wherever the button sits.
        createPortal(
          <div className="nn-hotline" role="dialog" aria-label="Talian hotline">
            <div className="nn-hotline__panel">
              {page === 'menu' ? (
                <Menu onPick={setPage} onClose={() => setPage(null)} />
              ) : page === 'sos' ? (
                <SosLebuhraya fix={fix} roadName={roadName} onBack={() => setPage('menu')} onClose={() => setPage(null)} />
              ) : (
                <GroupPage group={groupById(page)} onBack={() => setPage('menu')} onClose={() => setPage(null)} />
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/* ---------------- Main menu (like the TuJu "Talian hotline" screen) ---------------- */

function Menu({ onPick, onClose }: { onPick: (p: Page) => void; onClose: () => void }) {
  return (
    <>
      <Header title="Talian hotline" onClose={onClose} />
      <button className="nn-hotline__sos" onClick={() => onPick('sos')}>
        <span className="nn-hotline__sos-mark">SOS</span>
        <span>SOS Lebuhraya</span>
      </button>
      <div className="nn-hotline__grid">
        <Tile icon={<LlmIcon />} label="Talian LLM" onClick={() => onPick('llm')} />
        <Tile icon={<ShieldIcon />} label="Talian Insurans" onClick={() => onPick('insurance')} />
        <Tile icon={<HighwayIcon />} label="Talian Lebuhraya" onClick={() => onPick('highway')} />
        <Tile icon={<AsteriskIcon />} label="Talian Kecemasan" onClick={() => onPick('emergency')} />
      </div>
      <p className="nn-hotline__foot">
        Numbers checked 20 Nov 2026. Tapping a number opens your phone’s dialler. Never use the phone by hand while driving.
      </p>
    </>
  );
}

function Tile({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button className="nn-hotline__tile" onClick={onClick}>
      <span className="nn-hotline__tile-icon">{icon}</span>
      <span className="nn-hotline__tile-label">{label}</span>
    </button>
  );
}

/* ---------------- SOS Lebuhraya: location + the right highway hotline ---------------- */

function SosLebuhraya({
  fix,
  roadName,
  onBack,
  onClose,
}: {
  fix: GpsFix | null;
  roadName?: string | null;
  onBack: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const suggested = hotlinesForRoad(roadName);
  const others = groupById('highway').lines.filter((l) => !suggested.includes(l));

  const coords = fix ? `${fix.position[1].toFixed(5)}, ${fix.position[0].toFixed(5)}` : null;
  const mapsLink = fix ? `https://maps.google.com/?q=${fix.position[1].toFixed(6)},${fix.position[0].toFixed(6)}` : '';
  const shareText = fix
    ? `I need help on the highway. My location: ${coords}${roadName ? ` on ${roadName}` : ''} (±${Math.round(fix.accuracy)} m). ${mapsLink}`
    : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked - coordinates are still on screen to read out */
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: 'My location', text: shareText });
    } catch {
      /* cancelled or unsupported */
    }
  };

  return (
    <>
      <Header title="SOS Lebuhraya" onBack={onBack} onClose={onClose} />
      <div className="nn-hotline__scroll">
        <div className="nn-hotline__location">
          <div className="nn-hotline__label">Lokasi anda · Your location</div>
          {fix ? (
            <>
              <div className="nn-hotline__coords">{coords}</div>
              <div className="nn-hotline__hint">
                {roadName ? `${roadName} · ` : ''}±{Math.round(fix.accuracy)} m · also read the KM marker sign
              </div>
              <div className="nn-hotline__actions">
                <button onClick={copy}>{copied ? 'Copied ✓' : 'Copy location'}</button>
                {'share' in navigator && <button onClick={share}>Share location</button>}
              </div>
            </>
          ) : (
            <div className="nn-hotline__hint">
              Location not available. Tell the operator the highway, direction and nearest KM marker or exit.
            </div>
          )}
        </div>

        {suggested.length > 0 && (
          <>
            <div className="nn-hotline__label">For the road you’re on</div>
            <Lines lines={suggested} highlight />
          </>
        )}
        <div className="nn-hotline__label">{suggested.length ? 'Other highways' : 'Choose your highway'}</div>
        <Lines lines={others} />
        <div className="nn-hotline__label">Injury or danger?</div>
        <Lines lines={groupById('emergency').lines.slice(0, 1)} emergency />
        <p className="nn-hotline__foot">PLUS highways also have emergency telephones every 2 km. Wait behind the safety barrier.</p>
      </div>
    </>
  );
}

/* ---------------- One category: LLM / Insurans / Lebuhraya / Kecemasan ---------------- */

function GroupPage({ group, onBack, onClose }: { group: HotlineGroup; onBack: () => void; onClose: () => void }) {
  return (
    <>
      <Header title={group.title} onBack={onBack} onClose={onClose} />
      <div className="nn-hotline__scroll">
        <div className="nn-hotline__label">{group.subtitle}</div>
        <Lines lines={group.lines} emergency={group.id === 'emergency'} />
        {group.id === 'insurance' && (
          <p className="nn-hotline__foot">Use the insurer on your own policy. Their roadside assistance may include towing.</p>
        )}
      </div>
    </>
  );
}

function Lines({ lines, highlight, emergency }: { lines: Hotline[]; highlight?: boolean; emergency?: boolean }) {
  return (
    <ul className="nn-hotline__lines">
      {lines.map((l) => (
        <li key={l.dial}>
          <a className={`nn-hotline__line${highlight ? ' is-suggested' : ''}${emergency ? ' is-emergency' : ''}`} href={`tel:${l.dial}`}>
            <span className="nn-hotline__line-text">
              <span className="nn-hotline__line-name">{l.name}</span>
              <span className="nn-hotline__line-note">
                {l.note}
                {l.hours ? ` · ${l.hours}` : ''}
              </span>
            </span>
            <span className="nn-hotline__number">{l.display}</span>
            <span className="nn-hotline__call" aria-hidden="true">
              <PhoneIcon size={18} />
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function Header({ title, onBack, onClose }: { title: string; onBack?: () => void; onClose: () => void }) {
  return (
    <div className="nn-hotline__header">
      {onBack && (
        <button className="nn-hotline__round" onClick={onBack} aria-label="Back">
          <BackIcon />
        </button>
      )}
      <h2>{title}</h2>
      <button className="nn-hotline__round" onClick={onClose} aria-label="Close">
        <CloseIcon size={22} />
      </button>
    </div>
  );
}

/* ---------------- Simple generic icons (not copies of any organisation's logo) ---------------- */

function LlmIcon() {
  // A highway road sign - stands for the highway authority
  return (
    <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
      <rect x="6" y="6" width="36" height="28" rx="6" stroke="#4C8DF6" strokeWidth="3.5" />
      <path d="M17 28l4-16M31 28l-4-16M24 14v3M24 21v3" stroke="#4C8DF6" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 34v9" stroke="#4C8DF6" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 48 48">
      <path d="M24 4l16 6v12c0 10-7 18-16 22C15 40 8 32 8 22V10l16-6z" fill="#F5A524" />
      <path d="M16.5 24l5 5 10-10" stroke="#1B1F27" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function HighwayIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 48 48" fill="#3E9B3A">
      <path d="M8 8h10v6h-4v26H8z" />
      <rect x="10" y="18" width="2.5" height="3" fill="#1B1F27" />
      <rect x="10" y="25" width="2.5" height="3" fill="#1B1F27" />
      <path d="M20 26l3-7c.4-1 1.3-1.6 2.4-1.6h9.2c1.1 0 2 .6 2.4 1.6l3 7v10a1.5 1.5 0 0 1-1.5 1.5H37a1.5 1.5 0 0 1-1.5-1.5v-1.5h-11V36a1.5 1.5 0 0 1-1.5 1.5h-1.5A1.5 1.5 0 0 1 20 36V26zm4.5-.5h15l-2-5h-11l-2 5z" />
      <circle cx="25" cy="30" r="1.8" fill="#1B1F27" />
      <circle cx="35" cy="30" r="1.8" fill="#1B1F27" />
    </svg>
  );
}
function AsteriskIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 48 48" stroke="#E5484D" strokeWidth="7" strokeLinecap="round">
      <path d="M24 7v34M9.3 15.5l29.4 17M9.3 32.5l29.4-17" />
    </svg>
  );
}
