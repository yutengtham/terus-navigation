// Saved real responses from api.data.gov.my, captured 20 Nov 2026 (2:45 PM MYT), for the hazard checks.
// Trimmed to the fields the app reads; text is copied exactly. Fields not captured are left out.

/** GET /weather/warning - a real land thunderstorm warning + the real marine warning (which must NOT match roads). */
export const SAMPLE_WARNINGS: unknown = [
  {
    warning_issue: { issued: '2026-11-20T14:45:00', title_bm: 'Amaran Ribut Petir', title_en: 'Thunderstorms Warning' },
    valid_from: '2026-11-20T14:00:00',
    valid_to: '2026-11-20T18:00:00',
    heading_en: 'THUNDERSTORMS WARNING',
    heading_bm: 'AMARAN RIBUT PETIR',
    text_en:
      'Thunderstorms, heavy rain and strong winds are expected over the states of Terengganu (Hulu Terengganu and Kemaman) • Selangor (Klang, Petaling, Kuala Selangor and Gombak) • W.P. Kuala Lumpur • Johor (Segamat and Kota Tinggi) • Sarawak: Kapit (Song and Kapit), Bintulu, Miri, Limbang, Mukah (Mukah) • Sabah: Tawau (Lahad Datu), Kudat, West Coast, Interior, Sandakan • W.P. Labuan until 6:00 PM; Friday, 20 November 2026.',
    text_bm:
      'Ribut petir, hujan lebat dan angin kencang dijangka di negeri Terengganu (Hulu Terengganu dan Kemaman) • Selangor (Klang, Petaling, Kuala Selangor dan Gombak) • W.P. Kuala Lumpur • Johor (Segamat dan Kota Tinggi) • Sarawak: Kapit (Song dan Kapit), Bintulu, Miri, Limbang, Mukah (Mukah) • Sabah: Tawau (Lahad Datu), Kudat, Pantai Barat, Pedalaman, Sandakan • W.P. Labuan sehingga 6:00 Petang; Jumaat, 20 November 2026.',
    instruction_en: null,
    instruction_bm: null,
  },
  {
    warning_issue: { issued: '2026-11-20T13:50:00', title_bm: 'Amaran Angin Kencang dan Laut Bergelora', title_en: 'Strong Winds and Rough Seas Warning' },
    valid_from: '2026-11-20T13:00:00',
    valid_to: '2026-11-20T18:00:00',
    heading_en: 'THIRD CATEGORY WARNING ON STRONG WINDS AND ROUGH SEAS',
    text_en:
      'SECTION A: FOR MALAYSIAN WATERS [WITHIN 24 NAUTICAL MILES] 1) THUNDERSTORMS WARNING Thunderstorms, heavy rain and strong winds are expected over the waters of Pahang • Terengganu • Kelantan • Sarawak • Sabah until 6:00 PM; Friday, 20 November 2026. This condition may cause strong winds up to 50 kmph and rough seas with wave height up to 3.5 metres and is dangerous to small boats.',
    text_bm:
      'SEKSYEN A: UNTUK PERAIRAN MALAYSIA [DALAM LINGKUNGAN 24 BATU NAUTIKA] 1) AMARAN RIBUT PETIR Ribut petir, hujan lebat dan angin kencang dijangka di kawasan perairan Pahang • Terengganu • Kelantan • Sarawak • Sabah sehingga 6:00 Petang; Jumaat, 20 November 2026.',
  },
  {
    warning_issue: { issued: '2026-11-20T10:30:00', title_bm: 'Tiada Nasihat', title_en: 'No Advisory' },
    valid_from: null,
    valid_to: null,
    heading_en: 'No Advisory',
    text_en: 'No Tropical Cyclone system is observed under MMD monitoring region (Latitude: 0-20 North & Longitude: 95-130 East)',
  },
];

/** GET /flood-warning (real records - the feed's newest reading is 23 Feb 2024). */
export const SAMPLE_STATIONS: unknown = [
  {
    station_id: '26557',
    station_name: 'Sg. Kemensah di Kg. Kemensah',
    latitude: 3.214139,
    longitude: 101.767611,
    district: 'Gombak',
    state: 'SELANGOR',
    water_level_indicator: 'NORMAL',
    water_level_trend: 'RECEDING',
    water_level_update_datetime: '2024-02-23 14:45:00',
  },
  {
    station_id: '_CRAU0042',
    station_name: 'Sg. Dong di Kg. Peruas',
    latitude: 3.94385,
    longitude: 102.01854,
    district: 'Raub',
    state: 'PAHANG',
    water_level_indicator: 'ALERT',
    water_level_trend: 'RECEDING',
    water_level_update_datetime: '2024-02-23 14:45:00',
  },
];
