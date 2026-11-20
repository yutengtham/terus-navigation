// Draws a cartoon "DICARI / WANTED" poster with <canvas> - no image service, no bundled art.
// Paper texture, torn edges, pins, cartoon hazard illustrations and flames are all drawn here.

import type { AppLanguage } from '../i18n/arrowStrings';
import type { ReportType, RoadReport } from '../models/report';
import { DANGER_Y, fitText, FRAME, textStack, type Measure } from './posterLayout';
import { posterText } from './posterText';

export const POSTER_W = 1080;
export const POSTER_H = 1500;

const INK = '#3b2414';
const RED = '#8a1f11';
const HEAD_FONT = '"Impact", "Arial Black", "Helvetica Neue", "PingFang SC", "Noto Sans CJK SC", sans-serif';
const BODY_FONT = '"Georgia", "Times New Roman", "PingFang SC", "Noto Serif CJK SC", serif';

function rng(seedText: string): () => number {
  let h = 1779033703;
  for (const c of seedText) h = Math.imul(h ^ c.charCodeAt(0), 3432918353);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

type Ctx = CanvasRenderingContext2D;

function paper(ctx: Ctx, rand: () => number): void {
  // cork-board background
  ctx.fillStyle = '#5a4430';
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = `rgba(${rand() > 0.5 ? '0,0,0' : '255,220,170'},${0.05 + rand() * 0.08})`;
    ctx.fillRect(rand() * POSTER_W, rand() * POSTER_H, 3 + rand() * 6, 2 + rand() * 4);
  }
  // torn paper outline
  const x0 = 46, y0 = 40, x1 = POSTER_W - 46, y1 = POSTER_H - 40;
  ctx.save();
  ctx.beginPath();
  const edge = (ax: number, ay: number, bx: number, by: number) => {
    const n = 40;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const j = (rand() - 0.5) * 14;
      ctx.lineTo(ax + (bx - ax) * t + (ay === by ? 0 : j), ay + (by - ay) * t + (ax === bx ? 0 : j));
    }
  };
  ctx.moveTo(x0, y0);
  edge(x0, y0, x1, y0);
  edge(x1, y0, x1, y1);
  edge(x1, y1, x0, y1);
  edge(x0, y1, x0, y0);
  ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#f1e2bd');
  g.addColorStop(1, '#e2c995');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.clip();
  // speckles, fibres and a coffee ring
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(110,80,40,${rand() * 0.07})`;
    ctx.fillRect(rand() * POSTER_W, rand() * POSTER_H, 1 + rand() * 2.5, 1 + rand() * 2.5);
  }
  for (let i = 0; i < 2; i++) {
    const cx = 180 + rand() * 720, cy = 300 + rand() * 900, r = 60 + rand() * 50;
    ctx.strokeStyle = 'rgba(120,75,30,0.10)';
    ctx.lineWidth = 6 + rand() * 6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, rand() * 6, rand() * 6 + 5);
    ctx.stroke();
  }
  // burnt / aged edges
  const v = ctx.createRadialGradient(POSTER_W / 2, POSTER_H / 2, POSTER_H * 0.35, POSTER_W / 2, POSTER_H / 2, POSTER_H * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(110,60,20,0.35)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);
  ctx.restore();
  // pins
  for (const px of [120, POSTER_W - 120]) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(px + 5, 78, 18, 0, Math.PI * 2);
    ctx.fill();
    const pg = ctx.createRadialGradient(px - 6, 66, 2, px, 72, 18);
    pg.addColorStop(0, '#ff8a80');
    pg.addColorStop(1, '#c62828');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(px, 72, 17, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------- Cartoon illustrations (used when there is no photo) ----------

function scene(ctx: Ctx, w: number, h: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#bfe0f0');
  sky.addColorStop(0.45, '#e8f3e0');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#7d8590';
  ctx.beginPath();
  ctx.moveTo(w * 0.38, h * 0.42);
  ctx.lineTo(w * 0.62, h * 0.42);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#f3f3ee';
  ctx.lineWidth = 8;
  ctx.setLineDash([36, 30]);
  ctx.beginPath();
  ctx.moveTo(w / 2, h * 0.44);
  ctx.lineTo(w / 2, h);
  ctx.stroke();
  ctx.setLineDash([]);
}

function eyes(ctx: Ctx, cx: number, cy: number, s: number, angry = true): void {
  for (const dx of [-1, 1]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(cx + dx * s * 0.9, cy, s * 0.6, s * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(cx + dx * s * 0.8, cy + s * 0.15, s * 0.28, 0, Math.PI * 2);
    ctx.fill();
    if (angry) {
      ctx.strokeStyle = '#111';
      ctx.lineWidth = s * 0.22;
      ctx.beginPath();
      ctx.moveTo(cx + dx * s * 1.5, cy - s * 0.9);
      ctx.lineTo(cx + dx * s * 0.3, cy - s * 0.55);
      ctx.stroke();
    }
  }
}

function cone(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.fillStyle = '#ff7a1a';
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s * 0.42, y);
  ctx.lineTo(x - s * 0.42, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - s * 0.24, y - s * 0.55, s * 0.48, s * 0.12);
  ctx.fillStyle = '#333';
  ctx.fillRect(x - s * 0.55, y - s * 0.06, s * 1.1, s * 0.1);
}

const ILLUSTRATIONS: Record<ReportType, (ctx: Ctx, w: number, h: number) => void> = {
  pothole: (ctx, w, h) => {
    scene(ctx, w, h);
    const cx = w / 2, cy = h * 0.72;
    ctx.fillStyle = '#2b2622';
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.26, h * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a7a9a';
    ctx.beginPath();
    ctx.ellipse(cx, cy + h * 0.03, w * 0.2, h * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a3530';
    ctx.lineWidth = 5;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * w * 0.26, cy + Math.sin(a) * h * 0.13);
      ctx.lineTo(cx + Math.cos(a + 0.2) * w * 0.34, cy + Math.sin(a + 0.2) * h * 0.2);
      ctx.stroke();
    }
    eyes(ctx, cx, cy - h * 0.06, 26);
  },
  roadblock: (ctx, w, h) => {
    scene(ctx, w, h);
    const y = h * 0.62;
    ctx.fillStyle = '#555';
    ctx.fillRect(w * 0.22, y, 16, h * 0.28);
    ctx.fillRect(w * 0.76, y, 16, h * 0.28);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#fff' : '#d62828';
      ctx.fillRect(w * 0.18 + (i * w * 0.64) / 8, y, (w * 0.64) / 8, 56);
    }
    eyes(ctx, w / 2, y + 28, 18, true);
    cone(ctx, w * 0.12, h * 0.95, 110);
    cone(ctx, w * 0.88, h * 0.95, 110);
  },
  flooded: (ctx, w, h) => {
    scene(ctx, w, h);
    ctx.fillStyle = '#e04f3f';
    ctx.beginPath();
    ctx.roundRect(w * 0.36, h * 0.55, w * 0.28, h * 0.14, 30);
    ctx.fill();
    ctx.fillStyle = '#bfe6ff';
    ctx.fillRect(w * 0.41, h * 0.58, w * 0.18, h * 0.07);
    ctx.fillStyle = 'rgba(40,120,200,0.85)';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.64);
    for (let x = 0; x <= w; x += 40) ctx.quadraticCurveTo(x + 20, h * 0.6, x + 40, h * 0.64);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    // duck
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.ellipse(w * 0.78, h * 0.66, 44, 26, 0, 0, Math.PI * 2);
    ctx.ellipse(w * 0.8, h * 0.58, 22, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff8a1a';
    ctx.beginPath();
    ctx.moveTo(w * 0.82 + 16, h * 0.58);
    ctx.lineTo(w * 0.82 + 40, h * 0.59);
    ctx.lineTo(w * 0.82 + 16, h * 0.6 + 6);
    ctx.fill();
  },
  accident: (ctx, w, h) => {
    scene(ctx, w, h);
    // warning triangle and cones - kept gentle on purpose
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#d62828';
    ctx.lineWidth = 24;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.3);
    ctx.lineTo(w / 2 + 150, h * 0.82);
    ctx.lineTo(w / 2 - 150, h * 0.82);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.font = `bold 170px ${HEAD_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('!', w / 2, h * 0.76);
    cone(ctx, w * 0.18, h * 0.95, 120);
    cone(ctx, w * 0.82, h * 0.95, 120);
  },
  traffic_light: (ctx, w, h) => {
    scene(ctx, w, h);
    ctx.fillStyle = '#444';
    ctx.fillRect(w / 2 - 10, h * 0.55, 20, h * 0.45);
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.roundRect(w / 2 - 70, h * 0.08, 140, h * 0.5, 30);
    ctx.fill();
    ['#ff3b30', '#ffcc00', '#34c759'].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.17 + i * h * 0.15, 44, 0, Math.PI * 2);
      ctx.fill();
    });
    // dizzy spirals
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 5;
    for (const dx of [-18, 18]) {
      ctx.beginPath();
      for (let a = 0; a < 12; a += 0.3) ctx.lineTo(w / 2 + dx + Math.cos(a) * a * 1.2, h * 0.32 + Math.sin(a) * a * 1.2);
      ctx.stroke();
    }
  },
  other: (ctx, w, h) => {
    scene(ctx, w, h);
    ctx.fillStyle = '#ffcc00';
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.12);
    ctx.lineTo(w / 2 + 160, h * 0.42);
    ctx.lineTo(w / 2, h * 0.72);
    ctx.lineTo(w / 2 - 160, h * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.font = `bold 190px ${HEAD_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('?', w / 2, h * 0.52);
    cone(ctx, w * 0.2, h * 0.95, 110);
  },
};

function flame(ctx: Ctx, x: number, y: number, s: number, on: boolean): void {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.bezierCurveTo(x + s * 0.55, y - s * 0.45, x + s * 0.5, y, x, y);
  ctx.bezierCurveTo(x - s * 0.5, y, x - s * 0.55, y - s * 0.45, x, y - s);
  ctx.fillStyle = on ? '#ff6a1a' : 'rgba(80,60,40,0.18)';
  ctx.fill();
  if (on) {
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.5);
    ctx.bezierCurveTo(x + s * 0.28, y - s * 0.2, x + s * 0.25, y, x, y);
    ctx.bezierCurveTo(x - s * 0.25, y, x - s * 0.28, y - s * 0.2, x, y - s * 0.5);
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
  }
}

function logo(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.fillStyle = '#1677ff';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.6);
  ctx.lineTo(x + r * 0.45, y + r * 0.5);
  ctx.lineTo(x, y + r * 0.25);
  ctx.lineTo(x - r * 0.45, y + r * 0.5);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draws the poster for a report on a new canvas. `scale` makes smaller thumbnails
 * (0.25 = 270 px wide). The photo, if any, is decoded first.
 */
export async function renderPoster(r: RoadReport, lang: AppLanguage, scale = 1): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(POSTER_W * scale);
  canvas.height = Math.round(POSTER_H * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  const rand = rng(r.id);
  const text = posterText(r, lang);
  paper(ctx, rand);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  ctx.font = `900 190px ${HEAD_FONT}`;
  ctx.fillText(text.header, POSTER_W / 2, 255);
  ctx.font = `700 60px ${HEAD_FONT}`;
  ctx.fillText(text.sub, POSTER_W / 2, 330);
  ctx.fillRect(130, 308, 150, 6);
  ctx.fillRect(POSTER_W - 280, 308, 150, 6);

  // framed photo / illustration
  const { x: fx, y: fy, w: fw, h: fh } = FRAME;
  ctx.fillStyle = INK;
  ctx.fillRect(fx - 14, fy - 14, fw + 28, fh + 28);
  ctx.save();
  ctx.beginPath();
  ctx.rect(fx, fy, fw, fh);
  ctx.clip();
  let drewPhoto = false;
  if (r.photo) {
    try {
      const bmp = await createImageBitmap(r.photo);
      const k = Math.max(fw / bmp.width, fh / bmp.height);
      ctx.drawImage(bmp, fx + (fw - bmp.width * k) / 2, fy + (fh - bmp.height * k) / 2, bmp.width * k, bmp.height * k);
      bmp.close();
      ctx.fillStyle = 'rgba(200,160,90,0.18)'; // a little aged tint so it belongs on the poster
      ctx.fillRect(fx, fy, fw, fh);
      drewPhoto = true;
    } catch {
      /* fall back to the cartoon */
    }
  }
  if (!drewPhoto) {
    ctx.translate(fx, fy);
    ILLUSTRATIONS[r.type](ctx, fw, fh);
  }
  ctx.restore();
  // tape on two corners
  for (const [tx, ty, rot] of [
    [fx + 10, fy - 6, -0.5],
    [fx + fw - 10, fy - 6, 0.5],
  ] as const) {
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(rot);
    ctx.fillStyle = 'rgba(245,235,200,0.75)';
    ctx.fillRect(-60, -18, 120, 36);
    ctx.restore();
  }

  const measureWith = (font: (size: number) => string): Measure => (s, size) => {
    ctx.font = font(size);
    return ctx.measureText(s).width;
  };
  const roadFont = (size: number) => `900 ${size}px ${HEAD_FONT}`;
  const crimeFont = (size: number) => `italic 600 ${size}px ${BODY_FONT}`;
  const rewardFont = (size: number) => `800 ${size}px ${BODY_FONT}`;
  const road = fitText(text.roadLine, measureWith(roadFont), 900, 2, 92, 46);
  const crime = fitText(`“${text.crime}”`, measureWith(crimeFont), 880, 2, 44, 30);
  const reward = fitText(text.reward, measureWith(rewardFont), 880, 2, 48, 30);
  const stack = textStack(road, crime, reward);
  ctx.fillStyle = INK;
  ctx.font = roadFont(road.size);
  road.lines.forEach((line, i) => ctx.fillText(line, POSTER_W / 2, stack.roadY[i]));
  ctx.font = `italic 34px ${BODY_FONT}`;
  ctx.fillStyle = '#5b3a20';
  ctx.fillText(text.lastSeen, POSTER_W / 2, stack.lastSeenY);
  ctx.fillStyle = INK;
  ctx.font = crimeFont(crime.size);
  crime.lines.forEach((line, i) => ctx.fillText(line, POSTER_W / 2, stack.crimeY[i]));
  ctx.fillStyle = RED;
  ctx.font = rewardFont(reward.size);
  reward.lines.forEach((line, i) => ctx.fillText(line, POSTER_W / 2, stack.rewardY[i]));

  // danger level
  const dy = DANGER_Y;
  ctx.font = `700 32px ${BODY_FONT}`;
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  const label = `${text.dangerLabel}:`;
  const lw = ctx.measureText(label).width;
  const startX = POSTER_W / 2 - (lw + 20 + 5 * 52) / 2;
  ctx.fillText(label, startX, dy);
  for (let i = 0; i < 5; i++) flame(ctx, startX + lw + 40 + i * 52, dy + 6, 44, i < text.danger);

  // watermark
  ctx.globalAlpha = 0.75;
  logo(ctx, POSTER_W - 190, POSTER_H - 74, 16);
  ctx.font = `700 28px ${HEAD_FONT}`;
  ctx.fillStyle = INK;
  ctx.fillText('Terus', POSTER_W - 166, POSTER_H - 64);
  if (r.demo) {
    ctx.textAlign = 'left';
    ctx.font = `700 24px ${BODY_FONT}`;
    ctx.fillText('DEMO', 90, POSTER_H - 64);
  }
  ctx.globalAlpha = 1;
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.9));
}
