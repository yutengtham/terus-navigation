// Name tag shown above the avatar: max 12 characters, rude words blocked.
import { NAME_MAX } from '../config/avatars';

// A short, mild block list (English + Malay). Matching ignores case, spaces, dots and common
// letter swaps (0->o, 1->i, 3->e, 4->a, 5->s, @->a, $->s), so "B0d0h" is caught too.
const BLOCKED = ['fuck', 'shit', 'bitch', 'bastard', 'dick', 'cunt', 'asshole', 'puki', 'pukimak', 'babi', 'bodoh', 'sial', 'celaka', 'pantat', 'lancau', 'kimak', 'butoh', 'haram jadah', 'sundal', 'pelacur'];

function squash(s: string): string {
  return s
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1|!/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4|@/g, 'a')
    .replace(/5|\$/g, 's')
    .replace(/[^a-z]/g, '');
}

export function isRudeName(name: string): boolean {
  const s = squash(name);
  return BLOCKED.some((w) => s.includes(squash(w)));
}

/** Trims to 12 characters (by user-visible characters, so emoji count as one). */
export function cleanName(name: string): string {
  return [...name.replace(/\s+/g, ' ').trimStart()].slice(0, NAME_MAX).join('');
}
