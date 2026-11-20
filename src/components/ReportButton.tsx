import { useState } from 'react';
import type { AppLanguage } from '../i18n/arrowStrings';
import { REPORT_STRINGS } from '../i18n/reportStrings';
import { MapButton } from './MapButton';

/** Warning-triangle icon (drawn for Terus). */
function ReportIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 22 20H2Z" />
      <path d="M12 9v5M12 17v.5" strokeLinecap="round" />
    </svg>
  );
}

type Props = { language: AppLanguage; /** true while moving faster than 5 km/h */ moving: boolean; onReport: () => void };

/**
 * Round "Report" button in the side column. While moving it doesn't open the form; it shows
 * "Report when stopped" with an "I'm a passenger" option instead.
 */
export function ReportButton({ language, moving, onReport }: Props) {
  const t = REPORT_STRINGS[language];
  const [asking, setAsking] = useState(false);
  return (
    <div className="nn-report-btn">
      <MapButton label={moving ? t.reportWhenStopped : t.report} onClick={() => (moving ? setAsking((a) => !a) : onReport())} active={asking}>
        <span className={moving ? 'nn-report-btn__icon is-dim' : 'nn-report-btn__icon'}>
          <ReportIcon />
        </span>
      </MapButton>
      {asking && moving && (
        <div className="nn-report-btn__bubble" role="dialog">
          <span>{t.reportWhenStopped}</span>
          <button
            className="nn-link-button"
            onClick={() => {
              setAsking(false);
              onReport();
            }}
          >
            {t.passenger}
          </button>
        </div>
      )}
    </div>
  );
}
