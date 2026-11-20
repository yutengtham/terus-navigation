import type { ReactElement } from 'react';
import type { QuickCategoryId } from '../config/quickCategories';

/**
 * Simple white glyphs for the quick search buttons, drawn for Terus (24x24 grid).
 * Shown on top of a coloured circle.
 */
const GLYPHS: Record<QuickCategoryId, ReactElement> = {
  fuel: (
    <>
      <path d="M5 20V5.5A1.5 1.5 0 0 1 6.5 4h6A1.5 1.5 0 0 1 14 5.5V20Z" fill="currentColor" />
      <rect x="7" y="6.5" width="5" height="4" rx="0.8" fill="var(--nn-qc-bg)" />
      <path d="M14 9h1.6a1.4 1.4 0 0 1 1.4 1.4v5.1a1.5 1.5 0 0 0 3 0V8.2L17.6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  parking: <path d="M8 20V4h5a4.8 4.8 0 0 1 0 9.6H8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />,
  restaurant: (
    <>
      <path d="M6 3v6.5a2.5 2.5 0 0 0 5 0V3M8.5 3v18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M17.5 21V3c-2 1-3.5 3.5-3.5 7v3h3.5" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </>
  ),
  coffee: (
    <>
      <path d="M4 8h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z" fill="currentColor" />
      <path d="M16 9.5h1.5a2.5 2.5 0 0 1 0 5H16" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="M3.5 21h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M8 3.5c-.8 1 .8 1.8 0 3M12 3.5c-.8 1 .8 1.8 0 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  hospital: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3.5" fill="currentColor" />
      <path d="M12 7.5v9M7.5 12h9" stroke="var(--nn-qc-bg)" strokeWidth="2.8" strokeLinecap="round" />
    </>
  ),
  pharmacy: (
    <>
      <rect x="6.5" y="3" width="11" height="3" rx="1" fill="currentColor" />
      <path d="M7 7h10v12.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19.5Z" fill="currentColor" />
      <path d="M12 10.5v6M9 13.5h6" stroke="var(--nn-qc-bg)" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  clinic: (
    <>
      <path d="M6 4v5a4 4 0 0 0 8 0V4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M10 13v2.5a4.5 4.5 0 0 0 9 0V13" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="19" cy="11" r="2.2" fill="currentColor" />
    </>
  ),
  atm: (
    <>
      <rect x="3" y="5" width="18" height="12" rx="2" fill="currentColor" />
      <rect x="6" y="8" width="12" height="3" rx="0.8" fill="var(--nn-qc-bg)" />
      <path d="M8 20h8M10 17v3M14 17v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  groceries: (
    <>
      <path d="M2.5 4h2.6l2.3 10.5h10.2L20 7.5H6.2" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 8.5h12.2l-1.6 5H8Z" fill="currentColor" />
      <circle cx="9" cy="19" r="1.7" fill="currentColor" />
      <circle cx="16.5" cy="19" r="1.7" fill="currentColor" />
    </>
  ),
  ev: (
    <>
      <path d="M5 20V5.5A1.5 1.5 0 0 1 6.5 4h7A1.5 1.5 0 0 1 15 5.5V20Z" fill="currentColor" />
      <path d="M11 6.5 8 12h2.5l-1 4.5L13 10.5h-2.5Z" fill="var(--nn-qc-bg)" />
      <path d="M15 10h1.5a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 0 3 0V9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 20h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  mosque: (
    <>
      <path d="M12 3.5c1.2 1.6 4.5 3 4.5 6.5H7.5C7.5 6.5 10.8 5.1 12 3.5Z" fill="currentColor" />
      <path d="M6 11h12v9H6Z" fill="currentColor" />
      <path d="M10.3 20v-3.5a1.7 1.7 0 0 1 3.4 0V20" fill="var(--nn-qc-bg)" />
      <path d="M3.5 20V9M20.5 20V9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="3.5" cy="7.5" r="1" fill="currentColor" />
      <circle cx="20.5" cy="7.5" r="1" fill="currentColor" />
    </>
  ),
  toilet: (
    <>
      <circle cx="7.5" cy="4.5" r="1.8" fill="currentColor" />
      <circle cx="16.5" cy="4.5" r="1.8" fill="currentColor" />
      <path d="M5.5 8h4v7H8.5v5.5h-2V15H5.5Z" fill="currentColor" />
      <path d="M16.5 7.5l3 7.5h-1.8v5.5h-2.4V15h-1.8Z" fill="currentColor" />
      <path d="M12 3v18" stroke="currentColor" strokeWidth="1.2" opacity="0.7" />
    </>
  ),
  shopping: (
    <>
      <path d="M5 8h14l-1 12.5H6Z" fill="currentColor" />
      <path d="M9 10V6.5a3 3 0 0 1 6 0V10" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </>
  ),
  hotel: (
    <>
      <path d="M3 5v15M3 16h18v4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7.5" cy="11.5" r="2.2" fill="currentColor" />
      <path d="M11 9.5h7a3 3 0 0 1 3 3V16H11Z" fill="currentColor" />
    </>
  ),
  police: (
    <>
      <path d="M12 2.8 19.5 6v5.2c0 4.7-3.2 8.4-7.5 10-4.3-1.6-7.5-5.3-7.5-10V6Z" fill="currentColor" />
      <path d="m12 7.5 1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4Z" fill="var(--nn-qc-bg)" />
    </>
  ),
};

export function QuickCategoryIcon({ id, size = 26 }: { id: QuickCategoryId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {GLYPHS[id]}
    </svg>
  );
}
