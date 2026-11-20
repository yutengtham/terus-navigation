// Checks a user's .glb file and prepares it for the map: centred, standing on the ground,
// scaled to car size and turned to face the direction of travel (+X, like Terus's car).
// Pure functions on ArrayBuffers (no three.js), so they also run in the dev checks.

import { UPLOAD_MAX_BYTES, UPLOAD_MAX_TRIANGLES, UPLOAD_TARGET_LENGTH_M } from '../config/avatars';

export type GlbProblem =
  | 'too-big'
  | 'not-glb'
  | 'bad-version'
  | 'bad-json'
  | 'no-mesh'
  | 'external-files'
  | 'unsupported-extension'
  | 'too-many-triangles'
  | 'no-size'
  | 'not-indexed';

export const GLB_PROBLEM_TEXT: Record<GlbProblem, { en: string; ms: string; zh: string }> = {
  'too-big': { en: 'File is over 3 MB.', ms: 'Fail melebihi 3 MB.', zh: '文件超过 3 MB。' },
  'not-glb': { en: 'Not a .glb (binary glTF) file.', ms: 'Bukan fail .glb (glTF binari).', zh: '不是 .glb（二进制 glTF）文件。' },
  'bad-version': { en: 'Only glTF 2.0 is supported.', ms: 'Hanya glTF 2.0 disokong.', zh: '仅支持 glTF 2.0。' },
  'bad-json': { en: 'The file is damaged.', ms: 'Fail ini rosak.', zh: '文件已损坏。' },
  'no-mesh': { en: 'The file has no 3D shapes.', ms: 'Fail tiada bentuk 3D.', zh: '文件中没有 3D 模型。' },
  'external-files': { en: 'Textures must be inside the .glb (no separate files).', ms: 'Tekstur mesti di dalam .glb (tiada fail berasingan).', zh: '贴图必须包含在 .glb 内（不能是外部文件）。' },
  'unsupported-extension': { en: 'Compressed models (Draco / meshopt) are not supported.', ms: 'Model termampat (Draco / meshopt) tidak disokong.', zh: '不支持压缩模型（Draco / meshopt）。' },
  'too-many-triangles': { en: 'Too detailed: max 20,000 triangles.', ms: 'Terlalu terperinci: maks 20,000 segi tiga.', zh: '模型太精细：最多 20,000 个三角形。' },
  'no-size': { en: 'Could not work out the model size.', ms: 'Saiz model tidak dapat dikira.', zh: '无法计算模型大小。' },
  'not-indexed': { en: 'The map needs indexed triangles. Re-export the .glb (e.g. Blender defaults).', ms: 'Peta perlukan segi tiga berindeks. Eksport semula .glb (cth. tetapan asal Blender).', zh: '地图需要带索引的三角形，请重新导出 .glb（例如 Blender 默认设置）。' },
};

type Json = Record<string, unknown>;
type GltfNode = { mesh?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] };
type Accessor = { count?: number; min?: number[]; max?: number[] };
type Primitive = { attributes?: Record<string, number>; indices?: number; mode?: number };

export type GlbInfo = { triangles: number; min: [number, number, number]; max: [number, number, number] };
export type GlbCheck = { ok: true; info: GlbInfo; json: Json; bin: Uint8Array | null } | { ok: false; problem: GlbProblem };

/** Reads and validates a .glb. */
export function checkGlb(buf: ArrayBuffer): GlbCheck {
  if (buf.byteLength > UPLOAD_MAX_BYTES) return { ok: false, problem: 'too-big' };
  if (buf.byteLength < 20) return { ok: false, problem: 'not-glb' };
  const v = new DataView(buf);
  if (v.getUint32(0, true) !== 0x46546c67) return { ok: false, problem: 'not-glb' };
  if (v.getUint32(4, true) !== 2) return { ok: false, problem: 'bad-version' };
  const jsonLen = v.getUint32(12, true);
  if (v.getUint32(16, true) !== 0x4e4f534a || 20 + jsonLen > buf.byteLength) return { ok: false, problem: 'bad-json' };
  let json: Json;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
    if (typeof parsed !== 'object' || parsed === null) return { ok: false, problem: 'bad-json' };
    json = parsed as Json;
  } catch {
    return { ok: false, problem: 'bad-json' };
  }
  let bin: Uint8Array | null = null;
  const binStart = 20 + jsonLen;
  if (binStart + 8 <= buf.byteLength && v.getUint32(binStart + 4, true) === 0x004e4942) {
    const len = v.getUint32(binStart, true);
    bin = new Uint8Array(buf, binStart + 8, Math.min(len, buf.byteLength - binStart - 8));
  }
  const required = Array.isArray(json.extensionsRequired) ? (json.extensionsRequired as unknown[]) : [];
  if (required.some((e) => typeof e === 'string' && /draco|meshopt/i.test(e))) return { ok: false, problem: 'unsupported-extension' };
  const external = [...arr(json.buffers), ...arr(json.images)].some((b) => typeof (b as Json).uri === 'string' && !String((b as Json).uri).startsWith('data:'));
  if (external) return { ok: false, problem: 'external-files' };

  const meshes = arr(json.meshes) as { primitives?: Primitive[] }[];
  if (!meshes.length) return { ok: false, problem: 'no-mesh' };
  const accessors = arr(json.accessors) as Accessor[];
  const nodes = arr(json.nodes) as GltfNode[];

  // Triangles and world-space bounding box (node transforms applied to accessor min/max corners).
  // Mapbox's model layer only draws indexed triangles.
  if (meshes.some((m) => (m.primitives ?? []).some((p) => typeof p.indices !== 'number'))) return { ok: false, problem: 'not-indexed' };
  let triangles = 0;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const visit = (index: number, parent: number[], depth: number) => {
    const node = nodes[index];
    if (!node || depth > 64) return;
    const m = mul(parent, nodeMatrix(node));
    if (typeof node.mesh === 'number') {
      for (const p of meshes[node.mesh]?.primitives ?? []) {
        const mode = p.mode ?? 4;
        const pos = accessors[p.attributes?.POSITION ?? -1];
        const count = typeof p.indices === 'number' ? (accessors[p.indices]?.count ?? 0) : (pos?.count ?? 0);
        triangles += mode === 4 ? Math.floor(count / 3) : mode === 5 || mode === 6 ? Math.max(0, count - 2) : 0;
        if (pos?.min?.length === 3 && pos.max?.length === 3) {
          for (const cx of [pos.min[0], pos.max[0]])
            for (const cy of [pos.min[1], pos.max[1]])
              for (const cz of [pos.min[2], pos.max[2]]) {
                const w = apply(m, [cx, cy, cz]);
                for (let a = 0; a < 3; a++) {
                  min[a] = Math.min(min[a], w[a]);
                  max[a] = Math.max(max[a], w[a]);
                }
              }
        }
      }
    }
    for (const c of node.children ?? []) visit(c, m, depth + 1);
  };
  const scenes = arr(json.scenes) as { nodes?: number[] }[];
  const sceneIndex = typeof json.scene === 'number' ? json.scene : 0;
  const roots = scenes[sceneIndex]?.nodes ?? nodes.map((_, i) => i);
  for (const r of roots) visit(r, IDENTITY, 0);
  if (triangles === 0) return { ok: false, problem: 'no-mesh' };
  if (triangles > UPLOAD_MAX_TRIANGLES) return { ok: false, problem: 'too-many-triangles' };
  if (!min.every(Number.isFinite) || !max.every(Number.isFinite) || max.some((v2, i) => v2 - min[i] <= 0 && i !== 1)) {
    return { ok: false, problem: 'no-size' };
  }
  return { ok: true, info: { triangles, min, max }, json, bin };
}

/**
 * Wraps the scene in one new root node that centres the model, puts it on the ground,
 * scales its longest side to car length and turns it. `turns` = quarter turns around the
 * vertical axis; the default 1 turns a standard glTF model (facing +Z) to face +X.
 */
export function normaliseGlb(buf: ArrayBuffer, turns = 1): { glb: ArrayBuffer; info: GlbInfo } | { problem: GlbProblem } {
  const c = checkGlb(buf);
  if (!c.ok) return { problem: c.problem };
  const { json, bin, info } = c;
  const size = [info.max[0] - info.min[0], info.max[1] - info.min[1], info.max[2] - info.min[2]];
  const s = UPLOAD_TARGET_LENGTH_M / Math.max(size[0], size[2]);
  const centre = [(info.min[0] + info.max[0]) / 2, info.min[1], (info.min[2] + info.max[2]) / 2];
  const angle = ((((turns % 4) + 4) % 4) * Math.PI) / 2;
  const nodes = arr(json.nodes) as GltfNode[];
  const scenes = arr(json.scenes) as { nodes?: number[] }[];
  const sceneIndex = typeof json.scene === 'number' ? json.scene : 0;
  const roots = scenes[sceneIndex]?.nodes ?? nodes.map((_, i) => i);
  // offset node (moves the model's centre-bottom to the origin) inside a rotate+scale node
  const offsetIndex = nodes.length;
  const rootIndex = nodes.length + 1;
  nodes.push({ children: roots, translation: [-centre[0], -centre[1], -centre[2]] });
  nodes.push({ children: [offsetIndex], rotation: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)], scale: [s, s, s] });
  json.nodes = nodes;
  json.scenes = scenes.length ? scenes.map((sc, i) => (i === sceneIndex ? { ...sc, nodes: [rootIndex] } : sc)) : [{ nodes: [rootIndex] }];
  json.scene = sceneIndex;
  return { glb: packGlb(json, bin), info };
}

function packGlb(json: Json, bin: Uint8Array | null): ArrayBuffer {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const pad = (n: number) => (4 - (n % 4)) % 4;
  const jsonLen = jsonBytes.length + pad(jsonBytes.length);
  const binLen = bin ? bin.length + pad(bin.length) : 0;
  const total = 12 + 8 + jsonLen + (bin ? 8 + binLen : 0);
  const out = new ArrayBuffer(total);
  const v = new DataView(out);
  const bytes = new Uint8Array(out);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, total, true);
  v.setUint32(12, jsonLen, true);
  v.setUint32(16, 0x4e4f534a, true);
  bytes.set(jsonBytes, 20);
  bytes.fill(0x20, 20 + jsonBytes.length, 20 + jsonLen);
  if (bin) {
    const o = 20 + jsonLen;
    v.setUint32(o, binLen, true);
    v.setUint32(o + 4, 0x004e4942, true);
    bytes.set(bin, o + 8);
  }
  return out;
}

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// ---- 4x4 column-major matrices (glTF convention) ----
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a: number[], b: number[]): number[] {
  const o = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function apply(m: number[], p: number[]): number[] {
  return [0, 1, 2].map((r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);
}
function nodeMatrix(n: GltfNode): number[] {
  if (n.matrix?.length === 16) return n.matrix;
  const [tx, ty, tz] = n.translation ?? [0, 0, 0];
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale ?? [1, 1, 1];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}
