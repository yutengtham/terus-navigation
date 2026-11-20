import type { ReactNode } from 'react';
import { BackIcon } from '../components/icons';
import type { Settings } from '../hooks/useSettings';
import { isVoiceSupported, speak, unlockVoice } from '../services/voiceService';
import { presetFor } from '../config/avatars';
import { AVATAR_STRINGS, VOICE_STRINGS } from '../i18n/funStrings';
import { REPORT_STRINGS } from '../i18n/reportStrings';
import { PERSONALITIES, PERSONALITY_IDS, type PersonalityId } from '../config/data/voicePersonalities';
import { sayLine } from '../services/voiceJokes';
import { SPEECH_LANG } from '../i18n/arrowStrings';

type Props = {
  settings: Settings;
  onChange: (changes: Partial<Settings>) => void;
  onClearRecents: () => void;
  onClose: () => void;
  onOpenAvatar: () => void;
  onOpenWall: () => void;
};

/** Screen 5 - Settings. Every change is saved on this device straight away. */
export function SettingsScreen({ settings, onChange, onClearRecents, onClose, onOpenAvatar, onOpenWall }: Props) {
  const testVoice = () => {
    unlockVoice();
    speak('Voice guidance is on. In 300 metres, turn left onto Jalan Ampang.', { interrupt: true });
  };

  return (
    <div className="nn-search-screen" role="dialog" aria-label="Settings">
      <div className="nn-search-screen__inner">
        <div className="nn-card nn-search nn-search--active">
          <button className="nn-icon-button" onClick={onClose} aria-label="Back to map">
            <BackIcon />
          </button>
          <span className="nn-settings__title">Settings</span>
        </div>

        <div className="nn-card nn-results nn-settings">
          <Section title="Language">
            <Row label="Language" hint="Arrow Mode screen and its voice follow this. Other screens are English for now.">
              <Segmented
                value={settings.language}
                options={[
                  ['en', 'English'],
                  ['ms', 'Melayu'],
                  ['zh', '中文'],
                ]}
                onChange={(language) => onChange({ language })}
              />
            </Row>
          </Section>

          <Section title="Voice guidance">
            <Row label="Spoken directions" hint={isVoiceSupported() ? undefined : 'Not supported in this browser'}>
              <Switch checked={settings.voice} onChange={(voice) => onChange({ voice })} label="Spoken directions" />
            </Row>
            <PersonalityPicker settings={settings} onChange={onChange} />
            <Row label="Test the voice">
              <button className="nn-link-button" onClick={testVoice} disabled={!isVoiceSupported()}>
                Play sample
              </button>
            </Row>
          </Section>

          <Section title="Map appearance">
            <Row label="Day / night" hint={settings.appearance === 'auto' ? 'Night map from 7 pm to 7 am' : undefined}>
              <Segmented
                value={settings.appearance}
                options={[
                  ['auto', 'Auto'],
                  ['day', 'Day'],
                  ['night', 'Night'],
                ]}
                onChange={(appearance) => onChange({ appearance })}
              />
            </Row>
            <Row label="Map view" hint={settings.mapView === '2d' ? 'Flat, top-down map' : 'Tilted with 3D buildings'}>
              <Segmented
                value={settings.mapView}
                options={[
                  ['3d', '3D'],
                  ['2d', '2D'],
                ]}
                onChange={(mapView) => onChange({ mapView })}
              />
            </Row>
            <Row label="Detailed 3D" hint="Trees and landmarks. Turn off if the map feels slow.">
              <Switch checked={settings.detailed3d} onChange={(detailed3d) => onChange({ detailed3d })} label="Detailed 3D" />
            </Row>
          </Section>

          <Section title="Route options">
            <Row label="Avoid toll roads">
              <Switch checked={settings.avoidTolls} onChange={(avoidTolls) => onChange({ avoidTolls })} label="Avoid toll roads" />
            </Row>
            <Row label="Avoid highways" hint="Uses ordinary roads where possible">
              <Switch checked={settings.avoidHighways} onChange={(avoidHighways) => onChange({ avoidHighways })} label="Avoid highways" />
            </Row>
            <Row label="Avoid ferries" hint="e.g. Penang ferry">
              <Switch checked={settings.avoidFerries} onChange={(avoidFerries) => onChange({ avoidFerries })} label="Avoid ferries" />
            </Row>
          </Section>

          <Section title="Units">
            <Row label="Distance & speed">
              <Segmented
                value={settings.units}
                options={[
                  ['metric', 'km · km/h'],
                  ['imperial', 'mi · mph'],
                ]}
                onChange={(units) => onChange({ units })}
              />
            </Row>
          </Section>

          <Section title="Navigation">
            <Row label={AVATAR_STRINGS[settings.language].title} hint={avatarSummary(settings)}>
              <button className="nn-link-button" onClick={onOpenAvatar}>
                {AVATAR_STRINGS[settings.language].changeAvatar}
              </button>
            </Row>
            <Row label="Lane guidance" hint="Lane arrows, junction view and a lane voice cue before junctions">
              <Switch checked={settings.laneGuidance} onChange={(laneGuidance) => onChange({ laneGuidance })} label="Lane guidance" />
            </Row>
            <Row label="Lane view on map" hint="Draws the lanes on the map with a green guide path (driving only)">
              <Switch checked={settings.laneView} onChange={(laneView) => onChange({ laneView })} label="Lane view on map" />
            </Row>
            <Row label="Toll reminder" hint="Distance to the next toll plaza, with a reminder 1 km before">
              <Switch checked={settings.tollReminder} onChange={(tollReminder) => onChange({ tollReminder })} label="Toll reminder" />
            </Row>
            <Row label={REPORT_STRINGS[settings.language].settingsLabel} hint={REPORT_STRINGS[settings.language].settingsHint}>
              <Switch checked={settings.hazardReports} onChange={(hazardReports) => onChange({ hazardReports })} label={REPORT_STRINGS[settings.language].settingsLabel} />
            </Row>
            <Row label={REPORT_STRINGS[settings.language].wall}>
              <button className="nn-link-button" onClick={onOpenWall}>
                {REPORT_STRINGS[settings.language].wall}
              </button>
            </Row>
            <Row label="Flood & weather alerts" hint="Official MET Malaysia warnings and JPS river levels on your route (data.gov.my)">
              <Switch checked={settings.hazardAlerts} onChange={(hazardAlerts) => onChange({ hazardAlerts })} label="Flood & weather alerts" />
            </Row>
            <Row label="Voice hazard alerts" hint="Spoken alert about 5 km and 1 km before an affected stretch">
              <Switch checked={settings.hazardVoice} onChange={(hazardVoice) => onChange({ hazardVoice })} label="Voice hazard alerts" />
            </Row>
            <Row label="Keep screen on" hint="While navigating">
              <Switch checked={settings.keepScreenOn} onChange={(keepScreenOn) => onChange({ keepScreenOn })} label="Keep screen on" />
            </Row>
            <Row label="Arrow Mode demo" hint="Simulates walking along the route with a pretend GPS and compass – for presenting indoors. Turn off for real use.">
              <Switch checked={settings.arrowDemo} onChange={(arrowDemo) => onChange({ arrowDemo })} label="Arrow Mode demo" />
            </Row>
            <Row label="Flood alerts demo" hint="Adds a fake flood and thunderstorm alert (labelled DEMO) to every route – for presenting. Also: ?demo=flood. Turn off for real use.">
              <Switch checked={settings.floodDemo} onChange={(floodDemo) => onChange({ floodDemo })} label="Flood alerts demo" />
            </Row>
            <Row label="Recent searches">
              <button className="nn-link-button" onClick={onClearRecents}>
                Clear
              </button>
            </Row>
          </Section>

          <div className="nn-settings__about">
            Terus 0.9 · Maps, routes & traffic © Mapbox · © OpenStreetMap contributors · Street search powered by
            Geoapify. Weather warnings & forecast: MET Malaysia; river levels: JPS; district boundaries: DOSM – via data.gov.my,
            subject to the Malaysian Government Open Data Terms of Use 1.0. Never use the phone by hand while driving.
          </div>
        </div>
      </div>
    </div>
  );
}

/** Voice personality: pick one, and preview each (a sample instruction, then one of its lines). */
function PersonalityPicker({ settings, onChange }: { settings: Settings; onChange: (c: Partial<Settings>) => void }) {
  const t = VOICE_STRINGS[settings.language];
  const preview = (id: PersonalityId) => {
    unlockVoice();
    speak(t.sample, { interrupt: true, lang: SPEECH_LANG[settings.language] });
    const lines = PERSONALITIES[id].lines.turn_left ?? [];
    if (lines.length) {
      const i = Math.floor(Math.random() * lines.length);
      sayLine(id, { id: `${id}.turn_left.${i}`, text: lines[i] });
    }
  };
  return (
    <div className="nn-settings__row nn-voicepick">
      <div className="nn-settings__label">
        <span>{t.title}</span>
        <span className="nn-settings__hint">{t.hint}</span>
      </div>
      <div className="nn-voicepick__list" role="radiogroup" aria-label={t.title}>
        {PERSONALITY_IDS.map((id) => (
          <div key={id} className={`nn-voicepick__item${settings.voicePersonality === id ? ' is-on' : ''}`}>
            <button role="radio" aria-checked={settings.voicePersonality === id} className="nn-voicepick__pick" onClick={() => onChange({ voicePersonality: id })}>
              <strong>{t.people[id].name}</strong>
              <span>{t.people[id].desc}</span>
            </button>
            <button className="nn-link-button" onClick={() => preview(id)}>
              {t.preview}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function avatarSummary(s: Settings): string {
  const a = s.avatar;
  const body = a.body === 'upload' ? '.glb' : presetFor(a.body).name[s.language];
  return a.name ? `${body} · “${a.name}”` : body;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="nn-settings__section">
      <div className="nn-results__heading">{title}</div>
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="nn-settings__row">
      <div className="nn-settings__label">
        <span>{label}</span>
        {hint && <span className="nn-settings__hint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <input
      type="checkbox"
      role="switch"
      className="nn-switch"
      aria-label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="nn-segmented" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} role="radio" aria-checked={v === value} className={v === value ? 'is-active' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}
