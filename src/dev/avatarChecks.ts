import { AVATAR_PRESETS, type AvatarChoice } from '../config/avatars';
import { buildAvatarGlb, buildAvatarMesh } from '../services/avatarModels';
import { checkGlb, normaliseGlb } from '../services/glbImport';
import { cleanName, isRudeName } from '../services/nameTag';
import type { CheckResult } from './navChecks';

/** Avatar checks: every preset builds a valid, light .glb; upload validation; name tag rules. */
export function runAvatarChecks(): CheckResult[] {
  const results: CheckResult[] = [];
  const check = (name: string, pass: boolean, detail = '') => results.push({ name: `Avatar: ${name}`, pass, detail });

  const base: AvatarChoice = { body: 'durian', main: '#9bbf2a', accent: '#f2d24b', accessory: 'crown', name: '', forAllModes: false };
  const counts: string[] = [];
  let allValid = true;
  let maxTris = 0;
  for (const p of AVATAR_PRESETS) {
    if (p.id === 'car') continue;
    for (const acc of ['none', 'cap', 'sunglasses', 'flag', 'crown'] as const) {
      const choice = { ...base, body: p.id, accessory: acc };
      const glb = buildAvatarGlb(choice);
      const c = glb ? checkGlb(glb) : null;
      if (!c?.ok) allValid = false;
      const tris = buildAvatarMesh(choice)?.triangleCount() ?? 0;
      maxTris = Math.max(maxTris, tris);
      if (acc === 'none') counts.push(`${p.id} ${tris}`);
    }
  }
  check('Every preset x accessory builds a valid .glb', allValid);
  check('Presets stay light for mid-range phones (< 4,000 triangles)', maxTris < 4000, `max ${maxTris}; ${counts.join(', ')}`);

  const durian = buildAvatarGlb(base)!;
  const ok = checkGlb(durian);
  check('Own .glb passes the upload check with the right triangle count', ok.ok && ok.info.triangles === buildAvatarMesh(base)!.triangleCount(), ok.ok ? `${ok.info.triangles}` : ok.problem);

  const bad = (buf: ArrayBuffer, expected: string, label: string) => {
    const r = checkGlb(buf);
    check(label, !r.ok && r.problem === expected, r.ok ? 'accepted' : r.problem);
  };
  bad(new TextEncoder().encode('hello world, not a model').buffer, 'not-glb', 'Random bytes rejected: not a .glb');
  const v1 = durian.slice(0);
  new DataView(v1).setUint32(4, 1, true);
  bad(v1, 'bad-version', 'glTF 1.0 rejected');
  const broken = durian.slice(0);
  new Uint8Array(broken).fill(0x7b, 20, 40);
  bad(broken, 'bad-json', 'Damaged JSON rejected');
  bad(new ArrayBuffer(3 * 1024 * 1024 + 1), 'too-big', 'Over 3 MB rejected');
  // A valid .glb that points to an external texture file
  const ext = withJson(durian, (j) => ({ ...j, images: [{ uri: 'texture.png' }] }));
  bad(ext, 'external-files', 'External texture files rejected');
  const draco = withJson(durian, (j) => ({ ...j, extensionsRequired: ['KHR_draco_mesh_compression'] }));
  bad(draco, 'unsupported-extension', 'Draco-compressed rejected');
  const many = withJson(durian, (j) => {
    const accessors = (j.accessors as { count: number }[]).map((a) => ({ ...a, count: a.count * 20 }));
    return { ...j, accessors };
  });
  bad(many, 'too-many-triangles', 'Over 20,000 triangles rejected');

  const noIdx = withJson(durian, (j) => ({ ...j, meshes: (j.meshes as { primitives: Record<string, unknown>[] }[]).map((m) => ({ primitives: m.primitives.map(({ indices: _i, ...rest }) => rest) })) }));
  bad(noIdx, 'not-indexed', 'Un-indexed triangles rejected (the map cannot draw them)');
  // Normalising: a model 10x too big, turned 1 quarter -> car length, standing on the ground.
  const big = withJson(durian, (j) => ({ ...j, nodes: [{ mesh: 0, scale: [10, 10, 10], translation: [50, 20, -30] }] }));
  const n = normaliseGlb(big, 0);
  const again = 'glb' in n ? checkGlb(n.glb) : null;
  const len = again?.ok ? Math.max(again.info.max[0] - again.info.min[0], again.info.max[2] - again.info.min[2]) : 0;
  check(
    'Upload is centred, put on the ground and scaled to 4.6 m',
    !!again?.ok && Math.abs(len - 4.6) < 0.01 && Math.abs(again.info.min[1]) < 0.001 && Math.abs(again.info.min[0] + again.info.max[0]) < 0.01,
    again?.ok ? `length ${len.toFixed(2)} m, bottom ${again.info.min[1].toFixed(3)}` : 'failed',
  );
  const turned = normaliseGlb(durian, 1);
  const t = 'glb' in turned ? checkGlb(turned.glb) : null;
  check('A quarter turn swaps length and width', !!t?.ok && t.info.max[2] - t.info.min[2] > t.info.max[0] - t.info.min[0]);

  // Name tag
  check('Name tag: max 12 characters (emoji count as one)', cleanName('Raja Jalan Raya KL') === 'Raja Jalan R' && [...cleanName('🐯🐯🐯🐯🐯🐯🐯🐯🐯🐯🐯🐯🐯🐯')].length === 12);
  check('Name tag: rude words blocked, even with tricks (B0d0h, b.a.b.i)', isRudeName('B0d0h') && isRudeName('b.a.b.i') && isRudeName('KIMAK'));
  check('Name tag: normal names allowed (Ah Seng, Siti, Kak Long)', !isRudeName('Ah Seng') && !isRudeName('Siti') && !isRudeName('Kak Long'));
  return results;
}

/** Rewrites the JSON chunk of a .glb (for building broken test files). */
function withJson(glb: ArrayBuffer, f: (j: Record<string, unknown>) => Record<string, unknown>): ArrayBuffer {
  const v = new DataView(glb);
  const jsonLen = v.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, jsonLen))) as Record<string, unknown>;
  const binStart = 20 + jsonLen;
  const bin = new Uint8Array(glb, binStart + 8, v.getUint32(binStart, true));
  const bytes = new TextEncoder().encode(JSON.stringify(f(json)));
  const jl = bytes.length + ((4 - (bytes.length % 4)) % 4);
  const out = new ArrayBuffer(20 + jl + 8 + bin.length);
  const ov = new DataView(out);
  const ob = new Uint8Array(out);
  ov.setUint32(0, 0x46546c67, true);
  ov.setUint32(4, 2, true);
  ov.setUint32(8, out.byteLength, true);
  ov.setUint32(12, jl, true);
  ov.setUint32(16, 0x4e4f534a, true);
  ob.set(bytes, 20);
  ob.fill(0x20, 20 + bytes.length, 20 + jl);
  ov.setUint32(20 + jl, bin.length, true);
  ov.setUint32(24 + jl, 0x004e4942, true);
  ob.set(bin, 28 + jl);
  return out;
}
