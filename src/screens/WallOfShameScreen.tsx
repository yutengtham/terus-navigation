import { useEffect, useState } from 'react';
import { BackIcon } from '../components/icons';
import { useReports } from '../hooks/useReports';
import type { AppLanguage } from '../i18n/arrowStrings';
import { REPORT_ICON, REPORT_STRINGS, REPORT_TYPE_LABEL } from '../i18n/reportStrings';
import type { ReportType, RoadReport } from '../models/report';
import { renderPoster } from '../services/posterRenderer';
import { reportsRepository } from '../services/reportsRepository';

type Props = { language: AppLanguage; onOpen: (r: RoadReport) => void; onClose: () => void };

/** Small poster thumbnail, drawn on demand. */
function Thumb({ report, language }: { report: RoadReport; language: AppLanguage }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void renderPoster(report, language, 0.28).then((c) => alive && setSrc(c.toDataURL('image/jpeg', 0.8)));
    return () => {
      alive = false;
    };
  }, [report, language]);
  return src ? <img src={src} alt="" /> : <div className="nn-wall__ph" />;
}

/** "Wall of Shame": every poster the user made, with counts per hazard type. */
export function WallOfShameScreen({ language, onOpen, onClose }: Props) {
  const t = REPORT_STRINGS[language];
  const reports = useReports();
  const counts = reports.reduce<Partial<Record<ReportType, number>>>((m, r) => ({ ...m, [r.type]: (m[r.type] ?? 0) + 1 }), {});
  const top = (Object.entries(counts) as [ReportType, number][]).sort((a, b) => b[1] - a[1])[0];
  return (
    <div className="nn-screen nn-wall">
      <header className="nn-avatar__head">
        <button className="nn-icon-button" onClick={onClose} aria-label={t.close}>
          <BackIcon />
        </button>
        <h1>{t.wall}</h1>
      </header>
      <div className="nn-wall__body">
        {top ? (
          <>
            <p className="nn-wall__hero">{t.wallHero(top[1], REPORT_TYPE_LABEL[top[0]][language])}</p>
            <div className="nn-wall__counts">
              {(Object.entries(counts) as [ReportType, number][]).map(([k, n]) => (
                <span key={k} className="nn-chip">
                  {REPORT_ICON[k]} {REPORT_TYPE_LABEL[k][language]} × {n}
                </span>
              ))}
            </div>
            <p className="nn-wall__total">{t.total(reports.length)}</p>
          </>
        ) : (
          <p className="nn-wall__total">{t.wallEmpty}</p>
        )}
        <div className="nn-wall__grid">
          {reports.map((r) => (
            <div key={r.id} className="nn-wall__item">
              <button className="nn-wall__poster" onClick={() => onOpen(r)} aria-label={`${REPORT_TYPE_LABEL[r.type][language]} ${r.roadName}`}>
                <Thumb report={r} language={language} />
              </button>
              <button className="nn-link-button nn-link-button--muted" onClick={() => void reportsRepository.remove(r.id)}>
                {t.delete}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
