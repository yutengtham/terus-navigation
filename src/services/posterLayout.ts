// Pure text layout for the posters (no canvas), so long road names can be checked in tests.

export type Measure = (text: string, size: number) => number;
export type Fitted = { size: number; lines: string[] };

/** Splits into words; text without spaces (Chinese) wraps per character. */
function tokens(text: string): { parts: string[]; joiner: string } {
  const t = text.trim().replace(/\s+/g, ' ');
  return /\s/.test(t) ? { parts: t.split(' '), joiner: ' ' } : { parts: [...t], joiner: '' };
}

/** Greedy word wrap at one font size. A single word wider than the line is broken by characters. */
export function wrap(text: string, size: number, maxWidth: number, measure: Measure): string[] {
  const { parts, joiner } = tokens(text);
  const lines: string[] = [];
  let line = '';
  for (const p of parts) {
    const next = line ? line + joiner + p : p;
    if (measure(next, size) <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    if (measure(p, size) <= maxWidth) line = p;
    else {
      // very long single word: hard-break it
      let chunk = '';
      for (const ch of p) {
        if (measure(chunk + ch, size) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = ch;
        } else chunk += ch;
      }
      line = chunk;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Largest font size (from maxSize down to minSize) where the text fits in `maxLines` lines.
 * If even the smallest size doesn't fit, the last line is cut with "…".
 */
export function fitText(text: string, measure: Measure, maxWidth: number, maxLines: number, maxSize: number, minSize: number): Fitted {
  for (let size = maxSize; size >= minSize; size -= 2) {
    const lines = wrap(text, size, maxWidth, measure);
    if (lines.length <= maxLines) return { size, lines };
  }
  const lines = wrap(text, minSize, maxWidth, measure).slice(0, maxLines);
  let last = lines[maxLines - 1] ?? '';
  while (last && measure(last + '…', minSize) > maxWidth) last = [...last].slice(0, -1).join('').trimEnd();
  lines[maxLines - 1] = last + '…';
  return { size: minSize, lines };
}

/** "20 Nov 2026, 2:53pm" in Malaysia time. */
export function posterDate(ms: number, lang: 'en' | 'ms' | 'zh'): string {
  const d = new Date(ms);
  const date = new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : lang === 'ms' ? 'ms-MY' : 'en-GB', {
    day: 'numeric',
    month: lang === 'zh' ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'Asia/Kuala_Lumpur',
  }).format(d);
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' })
    .format(d)
    .replace(' ', '')
    .toLowerCase();
  return `${date}, ${time}`;
}

// ---- Vertical layout of the poster's text block (shared by the renderer and the checks) ----
export const FRAME = { x: 140, y: 365, w: 800, h: 470 };
export const DANGER_Y = 1380; // baseline of the danger meter (poster is 1500 tall)

export type TextStack = { roadY: number[]; lastSeenY: number; crimeY: number[]; rewardY: number[]; bottom: number };

/** Baselines for each text line, top to bottom, starting under the photo frame. */
export function textStack(road: Fitted, crime: Fitted, reward: Fitted): TextStack {
  let y = FRAME.y + FRAME.h + 40;
  const roadY = road.lines.map(() => (y += road.size * 0.95));
  const lastSeenY = (y += 46);
  y += 14;
  const crimeY = crime.lines.map(() => (y += crime.size * 1.2));
  y += 18;
  const rewardY = reward.lines.map(() => (y += reward.size * 1.15));
  return { roadY, lastSeenY, crimeY, rewardY, bottom: y };
}
