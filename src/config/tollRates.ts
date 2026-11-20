/**
 * Toll prices for cars (Class 1: 2 axles, 3-4 wheels, not taxis) at OPEN-system toll plazas,
 * where you pay one fixed amount per plaza. Distance-based (closed) highways such as PLUS
 * (North-South Expressway), NKVE, ELITE, LPT, LEKAS and WCE are NOT priced here: their price
 * depends on the exact entry and exit, and the official tables aren't available in usable form.
 *
 * RULES FOR THIS FILE (from the project brief: never invent toll prices)
 *  - Only rates confirmed by at least two independent published sources.
 *  - Where sources disagree, the plaza is left OUT (e.g. Second Penang Bridge: RM7.00 vs RM5.74).
 *  - Re-check after any government toll announcement. Official check: https://kadartol.llm.gov.my
 *
 * Last checked: 20 Nov 2026. Toll rates on these highways have been frozen in recent years
 * (ALR highways frozen until concession end; government postponed 2025 increases).
 *
 * Matching: Mapbox tells us each toll plaza the route passes ("Plaza Tol PJS 2") and the
 * road's route number ("E10"). `names` are matched against the plaza name after removing
 * "Plaza Tol" and direction marks like "(A)" / "(Arah Timur)".
 */
export type TollRate = {
  highway: string;
  /** Route numbers this highway uses */
  refs: string[];
  /** Plaza names (normalised: lower case, no "plaza tol", no direction marks) */
  names: string[];
  /** Ringgit for Class 1 */
  rm: number;
  /**
   * Name alone is ambiguous (e.g. "Ampang" is on SUKE and AKLEH): only match when Mapbox
   * also gives one of `refs` for that road.
   */
  needsRef?: boolean;
  sources: string;
};

export const TOLL_RATES_CHECKED = '20 Nov 2026';

export const TOLL_RATES: TollRate[] = [
  {
    highway: 'LDP',
    refs: ['E11'],
    names: ['petaling jaya', 'pjs', 'penchala', 'puchong barat', 'puchong selatan', 'puchong'],
    rm: 2.1,
    sources: 'The Star 21 Oct 2026 (ALR: "Class 1 motorists still paid RM2.10"); Wikipedia LDP; TollGuru 2026',
  },
  {
    highway: 'SPRINT',
    refs: ['E23'],
    names: ['bukit kiara'],
    rm: 3.0,
    sources: 'paultan.org 27 Jan 2016; calculatormalaysia.com 2026; motorist.my 2026 (ALR rates frozen)',
  },
  {
    highway: 'SPRINT',
    refs: ['E23'],
    names: ['damansara'],
    rm: 2.0,
    needsRef: false, // Mapbox gives no route number here; no other open plaza is called just "Damansara"
    sources: 'paultan.org 27 Jan 2016; calculatormalaysia.com 2026; motorist.my 2026',
  },
  {
    highway: 'SPRINT',
    refs: ['E23'],
    names: ['pantai', 'kerinchi'],
    rm: 2.5,
    needsRef: true,
    sources: 'paultan.org 27 Jan 2016; Gamuda ALR briefing Apr 2022 ("Pantai RM2.50"); Wikipedia SPRINT',
  },
  {
    highway: 'NPE',
    refs: ['E10'],
    names: ['pjs 5', 'pantai dalam'],
    rm: 2.3,
    sources: 'paultan.org 12 Oct 2015; IJM NPE toll fare page; klia2.info',
  },
  {
    highway: 'NPE',
    refs: ['E10'],
    names: ['pjs 2'],
    rm: 1.0,
    sources: 'paultan.org 12 Oct 2015; IJM NPE toll fare page',
  },
  {
    highway: 'DUKE',
    refs: ['E33'],
    names: ['batu', 'sungai batu', 'sentul pasar', 'ayer panas', 'air panas'],
    rm: 2.5,
    needsRef: true, // "Batu" alone is too common
    sources: 'Astro Awani / Malay Mail Oct 2015; Wikipedia DUKE (since 23 Nov 2017); TollGuru 2026',
  },
  {
    highway: 'MEX',
    refs: ['E20'],
    names: ['salak selatan'],
    rm: 2.0,
    sources: 'Malay Mail 12 Oct 2015; Wikipedia MEX; TollGuru 2026',
  },
  {
    highway: 'MEX',
    refs: ['E20'],
    names: ['putrajaya'],
    rm: 3.5,
    needsRef: true,
    sources: 'Works Minister via carz.com.my Jul 2025 ("current rate at RM3.50"); Malay Mail 2015; TollGuru 2026',
  },
  {
    highway: 'SUKE',
    refs: ['E19'],
    names: ['ampang', 'bukit teratai', 'alam damai'],
    rm: 2.3,
    needsRef: true, // "Ampang" also exists on AKLEH (E12)
    sources: 'FMT 29 Jun 2023; carz.com.my Jun 2023; The Sun (Prolintas)',
  },
  {
    highway: 'SPE',
    refs: ['E39'],
    names: ['chan sow lin', 'setiawangsa'],
    rm: 3.5,
    sources: 'paultan.org 8 Dec 2023; The Star / FMT 3 Nov 2023 (Works Minister)',
  },
  {
    highway: 'AKLEH',
    refs: ['E12'],
    names: ['dato keramat', 'datuk keramat', 'keramat'],
    rm: 2.13,
    sources: 'paultan.org 19 Oct 2022 (Prolintas, after 15% cut); motorist.my 2026',
  },
  {
    highway: 'SMART Tunnel',
    refs: ['E38'],
    names: ['smart sungai besi', 'smart'],
    rm: 3.0,
    sources: 'carlist.my / Astro Awani Oct 2015; ALR briefing 2022 (rate frozen); AsiaOne 2026',
  },
  {
    highway: 'Besraya',
    refs: ['E9'],
    names: ['mines selatan', 'mines utara', 'mines', 'loke yew'],
    rm: 1.85,
    sources: 'paultan.org 31 Dec 2022; Malay Mail 31 Dec 2022; The Vibes (from 1 Jan 2023)',
  },
  {
    highway: 'Cheras-Kajang (Grand Saga)',
    refs: ['E7'],
    names: ['batu 9'],
    rm: 1.3,
    sources: 'grandsaga.com.my toll rates; paultan.org 13 Oct 2015',
  },
  {
    highway: 'KESAS',
    refs: ['E5'],
    names: ['awan besar', 'sunway', 'kemuning'],
    rm: 2.0,
    needsRef: true,
    sources: 'Gamuda ALR briefing Apr 2022 ("KESAS user only pays RM2"); TollGuru 2026 (ALR rates frozen)',
  },
  {
    highway: 'KL-Karak',
    refs: ['E8'],
    names: ['gombak'],
    rm: 6.0,
    sources: 'Malay Mail 12 Oct 2015 (ANIH); carsome.my',
  },
  {
    highway: 'KL-Karak',
    refs: ['E8'],
    names: ['bentong'],
    rm: 3.5,
    sources: 'Malay Mail 12 Oct 2015 (ANIH); carsome.my',
  },
  {
    highway: 'Penang Bridge',
    refs: ['E36'],
    names: ['jambatan pulau pinang', 'penang bridge'],
    rm: 5.74,
    sources: 'Wikipedia Penang Bridge (since 1 Feb 2020, mainland-to-island only); TollGuru 2026',
  },
];
