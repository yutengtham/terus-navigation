import { useEffect, useState } from 'react';
import { POSTER_PHRASES } from '../config/data/posterPhrases';
import type { LngLat } from '../config/malaysia';
import type { AppLanguage } from '../i18n/arrowStrings';
import { REPORT_ICON, REPORT_STRINGS, REPORT_TYPE_LABEL } from '../i18n/reportStrings';
import type { ReportType, RoadReport } from '../models/report';
import { resizePhoto } from '../services/photoResize';
import { newReportId, reportsRepository } from '../services/reportsRepository';

const TYPES: ReportType[] = ['pothole', 'roadblock', 'flooded', 'accident', 'traffic_light', 'other'];

type Props = {
  language: AppLanguage;
  location: LngLat;
  /** Road name already known (navigation), or null to look it up */
  roadHint: string | null;
  lookupRoad: (p: LngLat) => Promise<string>;
  onSaved: (report: RoadReport) => void;
  onClose: () => void;
};

/** Report a road problem: type, optional note + photo; location and road name are filled in automatically. */
export function ReportSheet({ language, location, roadHint, lookupRoad, onSaved, onClose }: Props) {
  const t = REPORT_STRINGS[language];
  const [type, setType] = useState<ReportType>('pothole');
  const [road, setRoad] = useState<string | null>(roadHint);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (roadHint) return;
    let alive = true;
    void lookupRoad(location)
      .catch(() => '')
      .then((name) => alive && setRoad(name));
    return () => {
      alive = false;
    };
  }, [roadHint, location, lookupRoad]);

  useEffect(() => {
    if (!photo) return setPhotoUrl(null);
    const u = URL.createObjectURL(photo);
    setPhotoUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);

  const save = async () => {
    setSaving(true);
    const report: RoadReport = {
      id: newReportId(),
      type,
      createdAt: Date.now(),
      location,
      roadName: road ?? '',
      note: note.trim().slice(0, 140),
      photo,
      danger: POSTER_PHRASES[type].danger,
      lineSeed: Math.floor(Math.random() * 1000),
    };
    await reportsRepository.save(report);
    setSaving(false);
    onSaved(report);
  };

  return (
    <div className="nn-sheet-backdrop" onClick={onClose}>
      <div className="nn-card nn-report-sheet" role="dialog" aria-label={t.title} onClick={(e) => e.stopPropagation()}>
        <div className="nn-report-sheet__head">
          <strong>{t.title}</strong>
          <button className="nn-link-button" onClick={onClose}>
            {t.cancel}
          </button>
        </div>
        <div className="nn-report-types">
          {TYPES.map((k) => (
            <button key={k} className={`nn-report-type${type === k ? ' is-on' : ''}`} onClick={() => setType(k)}>
              <span aria-hidden="true">{REPORT_ICON[k]}</span>
              {REPORT_TYPE_LABEL[k][language]}
            </button>
          ))}
        </div>
        <div className="nn-report-sheet__where">
          <span>{t.where}</span>
          <strong>{road === null ? t.findingRoad : road || t.unknownRoad}</strong>
        </div>
        <label className="nn-report-sheet__field">
          <span>{t.note}</span>
          <input value={note} maxLength={140} placeholder={t.notePlaceholder} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="nn-report-sheet__photo">
          {photoUrl ? (
            <div className="nn-report-sheet__thumb">
              <img src={photoUrl} alt="" />
              <button className="nn-link-button" onClick={() => setPhoto(null)}>
                {t.removePhoto}
              </button>
            </div>
          ) : (
            <label className="nn-secondary-button nn-report-sheet__photobtn">
              📷 {t.photo}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void resizePhoto(f).then((b) => b && setPhoto(b));
                }}
              />
            </label>
          )}
          <p className="nn-report-sheet__hint">{t.photoHint}</p>
        </div>
        <button className="nn-primary-button" onClick={() => void save()} disabled={saving || road === null}>
          {saving ? t.saving : t.save}
        </button>
      </div>
    </div>
  );
}
