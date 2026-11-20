import { useEffect, useMemo, useState } from 'react';
import { AvatarPreview } from '../components/AvatarPreview';
import { BackIcon } from '../components/icons';
import { ACCESSORIES, AVATAR_PRESETS, NAME_MAX, PALETTES, presetFor, type AvatarChoice } from '../config/avatars';
import { UPLOAD_KEY } from '../hooks/useAvatarModel';
import type { AppLanguage } from '../i18n/arrowStrings';
import { AVATAR_STRINGS } from '../i18n/funStrings';
import { buildAvatarGlb } from '../services/avatarModels';
import { GLB_PROBLEM_TEXT, normaliseGlb, type GlbProblem } from '../services/glbImport';
import { cleanName, isRudeName } from '../services/nameTag';
import { idbGet, idbSet } from '../utils/idb';

type Props = {
  choice: AvatarChoice;
  language: AppLanguage;
  onSave: (choice: AvatarChoice) => void;
  onClose: () => void;
};

const CLASSIC_CAR_URL = new URL('/models/car.glb', window.location.href).href;

/** Pick / build / upload the avatar that represents you on the map. */
export default function AvatarScreen({ choice, language, onSave, onClose }: Props) {
  const t = AVATAR_STRINGS[language];
  const [draft, setDraft] = useState<AvatarChoice>(choice);
  const [uploadSrc, setUploadSrc] = useState<ArrayBuffer | null>(null);
  const [turns, setTurns] = useState(1);
  const [storedUpload, setStoredUpload] = useState<ArrayBuffer | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void idbGet<ArrayBuffer>(UPLOAD_KEY).then((b) => b && setStoredUpload(b));
  }, []);

  const upload = useMemo<{ glb: ArrayBuffer; triangles: number } | { problem: GlbProblem } | null>(() => {
    if (!uploadSrc) return null;
    const r = normaliseGlb(uploadSrc, turns);
    return 'problem' in r ? r : { glb: r.glb, triangles: r.info.triangles };
  }, [uploadSrc, turns]);
  const uploadGlb = upload && 'glb' in upload ? upload.glb : null;

  const preview = useMemo<ArrayBuffer | string | null>(() => {
    if (draft.body === 'car') return CLASSIC_CAR_URL;
    if (draft.body === 'upload') return uploadGlb ?? storedUpload;
    return buildAvatarGlb(draft);
  }, [draft, uploadGlb, storedUpload]);

  const set = (changes: Partial<AvatarChoice>) => setDraft((d) => ({ ...d, ...changes }));
  const pickBody = (id: AvatarChoice['body']) => {
    if (id === 'upload') return set({ body: 'upload' });
    const p = presetFor(id);
    // Switching body brings that body's own colours, unless the user already picked colours for another body.
    set({ body: id, ...(draft.body === 'car' || draft.body === 'upload' || (draft.main === presetFor(draft.body).main && draft.accent === presetFor(draft.body).accent) ? { main: p.main, accent: p.accent } : {}) });
  };
  const rude = isRudeName(draft.name);
  const classic = draft.body === 'car';
  const canSave = !rude && (draft.body !== 'upload' || !!uploadGlb || !!storedUpload);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    if (draft.body === 'upload' && uploadGlb) await idbSet(UPLOAD_KEY, uploadGlb);
    onSave({ ...draft, name: draft.name.trim() });
    setSaving(false);
  };

  return (
    <div className="nn-screen nn-avatar">
      <header className="nn-avatar__head">
        <button className="nn-icon-button" onClick={onClose} aria-label={t.cancel}>
          <BackIcon />
        </button>
        <h1>{t.title}</h1>
        <button className="nn-primary-button nn-avatar__done" onClick={() => void save()} disabled={!canSave || saving}>
          {t.done}
        </button>
      </header>

      <div className="nn-avatar__stage">
        {preview ? <AvatarPreview model={preview} label={t.title} /> : <div className="nn-avatar__empty">{t.uploadHint}</div>}
        {draft.name && !rude && <div className="nn-avatar-tag nn-avatar-tag--preview">{draft.name}</div>}
        <span className="nn-avatar__drag">{t.dragHint}</span>
      </div>

      <div className="nn-avatar__body">
        <h2>{t.presets}</h2>
        <div className="nn-avatar__grid">
          {AVATAR_PRESETS.map((p) => (
            <button key={p.id} className={`nn-avatar__tile${draft.body === p.id ? ' is-on' : ''}`} onClick={() => pickBody(p.id)}>
              <span className="nn-avatar__swatch" style={{ background: p.main, borderColor: p.accent }} />
              {p.name[language]}
            </button>
          ))}
          <button className={`nn-avatar__tile${draft.body === 'upload' ? ' is-on' : ''}`} onClick={() => pickBody('upload')}>
            <span className="nn-avatar__swatch nn-avatar__swatch--upload">⬆</span>
            .glb
          </button>
        </div>

        {draft.body === 'upload' ? (
          <section className="nn-avatar__section">
            <h2>{t.upload}</h2>
            <p className="nn-avatar__hint">{t.uploadHint}</p>
            <input
              type="file"
              accept=".glb,model/gltf-binary"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void f.arrayBuffer().then((b) => {
                  setTurns(1);
                  setUploadSrc(b);
                });
              }}
            />
            {upload && 'problem' in upload && <p className="nn-avatar__error">{GLB_PROBLEM_TEXT[upload.problem][language]}</p>}
            {upload && 'glb' in upload && (
              <div className="nn-avatar__row">
                <span className="nn-avatar__ok">{t.uploadOk(upload.triangles)}</span>
                <button className="nn-link-button" onClick={() => setTurns((n) => n + 1)}>
                  {t.rotate}
                </button>
              </div>
            )}
          </section>
        ) : (
          <section className="nn-avatar__section">
            <h2>{t.build}</h2>
            {classic ? (
              <p className="nn-avatar__hint">{t.classicNote}</p>
            ) : (
              <>
                <div className="nn-avatar__row">
                  <label className="nn-avatar__colour">
                    <input type="color" value={draft.main} onChange={(e) => set({ main: e.target.value })} />
                    {t.main}
                  </label>
                  <label className="nn-avatar__colour">
                    <input type="color" value={draft.accent} onChange={(e) => set({ accent: e.target.value })} />
                    {t.accent}
                  </label>
                </div>
                <div className="nn-avatar__chips" aria-label={t.palettes}>
                  {PALETTES.map((p) => (
                    <button key={p.main} className="nn-avatar__palette" onClick={() => set({ main: p.main, accent: p.accent })}>
                      <span style={{ background: p.main }} />
                      <span style={{ background: p.accent }} />
                      {p.name[language]}
                    </button>
                  ))}
                </div>
                <h2>{t.accessory}</h2>
                <div className="nn-avatar__chips">
                  {ACCESSORIES.map((a) => (
                    <button key={a.id} className={`nn-chip-toggle${draft.accessory === a.id ? ' is-on' : ''}`} onClick={() => set({ accessory: a.id })}>
                      {a.name[language]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        <section className="nn-avatar__section">
          <h2>{t.nameTag}</h2>
          <input
            className="nn-avatar__name"
            value={draft.name}
            maxLength={NAME_MAX * 2}
            placeholder={t.namePlaceholder}
            onChange={(e) => set({ name: cleanName(e.target.value) })}
          />
          {rude && <p className="nn-avatar__error">{t.nameRude}</p>}
          <label className="nn-switch-row">
            <span>{t.allModes}</span>
            <input type="checkbox" role="switch" className="nn-switch" checked={draft.forAllModes} onChange={(e) => set({ forAllModes: e.target.checked })} />
          </label>
        </section>
      </div>
    </div>
  );
}
