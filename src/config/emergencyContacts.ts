/**
 * Malaysian emergency, highway and insurance hotlines for the SOS button.
 *
 * Every number was checked on 20 Nov 2026 against official sources (operator / insurer
 * websites, Bernama, Touch 'n Go support) or, for some highway operators whose own sites
 * could not be checked, at least two independent published lists that agree.
 * Numbers can change - re-check them before each release.
 */

export type Hotline = {
  name: string;
  /** What it covers, shown under the name */
  note: string;
  /** Number as people read it */
  display: string;
  /** Digits only, for the phone dialler (tel: link) */
  dial: string;
  hours?: string;
  /**
   * Road names / route numbers this operator runs (matched against the road you are on during
   * navigation, so SOS Lebuhraya can put the right hotline first).
   */
  roads?: string[];
};

export type HotlineGroup = {
  id: 'emergency' | 'llm' | 'highway' | 'insurance';
  title: string; // Malay first, like Malaysian road signs and the TuJu app
  subtitle: string;
  lines: Hotline[];
};

export const HOTLINE_GROUPS: HotlineGroup[] = [
  {
    id: 'emergency',
    title: 'Talian Kecemasan',
    subtitle: 'Emergency – police, ambulance, fire',
    lines: [
      { name: 'MERS 999', note: 'Polis, ambulans, bomba, APM', display: '999', dial: '999', hours: '24 jam' },
      { name: '112 (mobile)', note: 'Same 999 operators, from any mobile phone', display: '112', dial: '112', hours: '24 jam' },
    ],
  },
  {
    id: 'llm',
    title: 'Talian LLM',
    subtitle: 'Lembaga Lebuhraya Malaysia – traffic info & help',
    lines: [
      { name: 'Talian LLM', note: 'Pusat Pengurusan Trafik LLM', display: '1800-88-7752', dial: '1800887752', hours: '7 pagi – 10 malam' },
    ],
  },
  {
    id: 'highway',
    title: 'Talian Lebuhraya',
    subtitle: 'Highway operators – breakdown, towing, accidents',
    lines: [
      { name: 'PLUSLine', note: 'PLUS (E1, E2), ELITE (E6) – PLUSRonda', display: '1800-88-0000', dial: '1800880000', hours: '24 jam',
        roads: ['E1', 'E2', 'E6', 'Utara–Selatan', 'Utara-Selatan', 'North–South', 'North-South', 'ELITE', 'PLUS'] },
      { name: 'LPT-Line (ANIH)', note: 'KL–Karak (E8), LPT1', display: '1700-818-700', dial: '1700818700',
        roads: ['E8', 'Karak', 'Pantai Timur', 'LPT1', 'East Coast'] },
      { name: 'LPT2Line', note: 'Lebuhraya Pantai Timur 2', display: '1800-88-0220', dial: '1800880220',
        roads: ['E8', 'LPT2', 'Pantai Timur 2', 'East Coast'] },
      { name: 'LDP & SPRINT', note: 'Lebuhraya Damansara–Puchong, SPRINT', display: '03-7494 7333', dial: '0374947333',
        roads: ['E11', 'E23', 'Damansara–Puchong', 'Damansara-Puchong', 'LDP', 'SPRINT', 'Penchala'] },
      { name: 'KESAS', note: 'Lebuhraya Shah Alam (E5)', display: '03-5633 7188', dial: '0356337188',
        roads: ['E5', 'KESAS', 'Shah Alam Expressway', 'Lebuhraya Shah Alam'] },
      { name: 'DUKE', note: 'Lebuhraya Duta–Ulu Kelang', display: '03-6251 3100', dial: '0362513100',
        roads: ['E33', 'DUKE', 'Duta–Ulu Kelang', 'Duta-Ulu Kelang'] },
      { name: 'LATAR', note: 'KL–Kuala Selangor (E25)', display: '03-6145 1515', dial: '0361451515',
        roads: ['E25', 'LATAR', 'Kuala Lumpur–Kuala Selangor'] },
      { name: 'SKVE', note: 'South Klang Valley Expressway (E26)', display: '1300-88-0026', dial: '1300880026',
        roads: ['E26', 'SKVE', 'Lembah Klang Selatan'] },
    ],
  },
  {
    id: 'insurance',
    title: 'Talian Insurans',
    subtitle: '24/7 roadside assistance – check your own policy',
    lines: [
      { name: 'Etiqa', note: 'Etiqa Auto Assist', display: '1800-88-6491', dial: '1800886491', hours: '24 jam' },
      { name: 'Allianz', note: 'Allianz Road Rangers', display: '1800-22-5542', dial: '1800225542' },
      { name: 'Takaful Malaysia', note: 'Syarikat Takaful Malaysia Am', display: '1800-888-788', dial: '1800888788' },
      { name: 'Zurich Takaful', note: 'Zurich General Takaful Malaysia', display: '1300-88-5566', dial: '1300885566' },
      { name: 'MSIG', note: 'MSIG Insurance (Malaysia)', display: '1300-880-833', dial: '1300880833' },
      { name: 'Tokio Marine', note: 'Tokio Marine Insurans (Malaysia)', display: '1800-88-1301', dial: '1800881301' },
      { name: 'Chubb', note: 'Chubb Insurance Malaysia', display: '1300-88-0128', dial: '1300880128' },
      { name: 'Liberty', note: 'Liberty General Insurance', display: '1800-88-5005', dial: '1800885005', hours: '24 jam' },
    ],
  },
];

export function groupById(id: HotlineGroup['id']): HotlineGroup {
  return HOTLINE_GROUPS.find((g) => g.id === id)!;
}

/** Highway hotlines for the road you are on (by name or route number such as "E1"). */
export function hotlinesForRoad(road: string | null | undefined): Hotline[] {
  if (!road) return [];
  const words = road.toLowerCase();
  return groupById('highway').lines.filter((l) =>
    l.roads?.some((r) => (/^E\d+$/i.test(r) ? new RegExp(`\\b${r}\\b`, 'i').test(road) : words.includes(r.toLowerCase()))),
  );
}
