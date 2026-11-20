import { useEffect, useState } from 'react';
import { BackIcon } from '../components/icons';
import type { AppLanguage } from '../i18n/arrowStrings';
import { REPORT_STRINGS } from '../i18n/reportStrings';
import type { RoadReport } from '../models/report';
import { sendToMyJalan } from '../services/myJalan';
import { canvasToBlob, renderPoster } from '../services/posterRenderer';
import { reportPlainText } from '../services/posterText';
import { reportsRepository } from '../services/reportsRepository';

type Props = { report: RoadReport; language: AppLanguage; onClose: () => void; onOpenWall: () => void };

/** The "DICARI / WANTED" poster for one report: share, download, new joke line, danger level, MyJalan. */
export function PosterScreen({ report: initial, language, onClose, onOpenWall }: Props) {
  const t = REPORT_STRINGS[language];
  const [report, setReport] = useState(initial);
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [note, setNote] = useState<string | null>(t.saved);

  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    void renderPoster(report, language)
      .then(canvasToBlob)
      .then((b) => {
        if (!alive || !b) return;
        made = URL.createObjectURL(b);
        setBlob(b);
        setUrl(made);
      });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [report, language]);

  const update = (changes: Partial<RoadReport>) => {
    const next = { ...report, ...changes };
    setReport(next);
    void reportsRepository.save(next);
  };

  const fileName = `terus-dicari-${report.type}-${report.id}.jpg`;
  const download = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
  };
  const share = async () => {
    if (!blob) return;
    const file = new File([blob], fileName, { type: 'image/jpeg' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'DICARI / WANTED', text: reportPlainText(report, language) });
        return;
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // user closed the share sheet
    }
    download();
    setNote(t.sharedFallback);
  };

  return (
    <div className="nn-screen nn-poster">
      <header className="nn-avatar__head">
        <button className="nn-icon-button" onClick={onClose} aria-label={t.close}>
          <BackIcon />
        </button>
        <h1>DICARI</h1>
        <button className="nn-link-button" onClick={onOpenWall}>
          {t.wall}
        </button>
      </header>
      <div className="nn-poster__img">{url ? <img src={url} alt={`DICARI / WANTED – ${report.roadName}`} /> : <div className="nn-poster__loading" />}</div>
      {note && <p className="nn-poster__note">{note}</p>}
      <div className="nn-poster__danger" aria-label={t.danger}>
        <span>{t.danger}</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={n <= report.danger ? 'is-on' : ''} onClick={() => update({ danger: n })} aria-label={`${n}`}>
            🔥
          </button>
        ))}
      </div>
      <div className="nn-poster__actions">
        <button className="nn-primary-button" onClick={() => void share()} disabled={!blob}>
          {t.share}
        </button>
        <button className="nn-secondary-button" onClick={() => update({ lineSeed: report.lineSeed + 1 })}>
          {t.regenerate}
        </button>
        <button className="nn-secondary-button" onClick={download} disabled={!url}>
          {t.download}
        </button>
        <button
          className="nn-secondary-button"
          onClick={() => void sendToMyJalan(reportPlainText(report, language)).then((ok) => setNote(ok ? t.myJalanCopied : null))}
        >
          {t.myJalan}
        </button>
      </div>
    </div>
  );
}
