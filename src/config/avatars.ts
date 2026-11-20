// Avatar presets for the map (all original Terus designs, built in the browser from simple shapes).

import type { AppLanguage } from '../i18n/arrowStrings';

export type AvatarBody = 'car' | 'hatchback' | 'kapcai' | 'lorry' | 'durian' | 'cat' | 'tapir' | 'tiger' | 'tehtarik';
export type AvatarAccessory = 'none' | 'cap' | 'sunglasses' | 'flag' | 'crown';

/** What the user picked. `body: 'upload'` = their own .glb (stored on the device). */
export type AvatarChoice = {
  body: AvatarBody | 'upload';
  main: string;
  accent: string;
  accessory: AvatarAccessory;
  /** Floating name tag, max 12 characters ('' = none) */
  name: string;
  /** Also use the avatar when walking / cycling (default: walker / bicycle keep their models) */
  forAllModes: boolean;
};

type Text = Record<AppLanguage, string>;

export type AvatarPreset = {
  id: AvatarBody;
  name: Text;
  main: string;
  accent: string;
  /** Size on the map (same idea as the car's 2.5x) */
  scale: number;
  /** Idle animation: animals bob, vehicles bounce slightly */
  idle: 'bob' | 'bounce' | 'none';
  /** Arrival animation */
  arrive: 'hop' | 'spin';
  /** Horn when tapped while stopped (made with Web Audio, no files) */
  horn: { wave: OscillatorType; from: number; to: number; ms: number; repeat: number };
  /** The classic car keeps its own colours (it's the original model file). */
  fixedColours?: boolean;
};

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'car', name: { en: 'Classic car', ms: 'Kereta klasik', zh: '经典汽车' }, main: '#f5f7fa', accent: '#1677ff', scale: 2.5, idle: 'none', arrive: 'spin', horn: { wave: 'square', from: 420, to: 420, ms: 160, repeat: 2 }, fixedColours: true },
  { id: 'hatchback', name: { en: 'Hatchback', ms: 'Hatchback', zh: '掀背车' }, main: '#e8443a', accent: '#f5f7fa', scale: 2.5, idle: 'bounce', arrive: 'hop', horn: { wave: 'square', from: 520, to: 520, ms: 120, repeat: 2 } },
  { id: 'kapcai', name: { en: 'Kapcai', ms: 'Kapcai', zh: '小摩托' }, main: '#1677ff', accent: '#ffd23f', scale: 2.5, idle: 'bounce', arrive: 'hop', horn: { wave: 'square', from: 880, to: 880, ms: 90, repeat: 3 } },
  { id: 'lorry', name: { en: 'Lorry', ms: 'Lori', zh: '罗厘' }, main: '#ff8c1a', accent: '#d9dee5', scale: 2.5, idle: 'bounce', arrive: 'spin', horn: { wave: 'sawtooth', from: 180, to: 170, ms: 600, repeat: 1 } },
  { id: 'durian', name: { en: 'Durian on wheels', ms: 'Durian beroda', zh: '榴莲车' }, main: '#9bbf2a', accent: '#f2d24b', scale: 2.5, idle: 'bounce', arrive: 'spin', horn: { wave: 'sine', from: 300, to: 900, ms: 260, repeat: 1 } },
  { id: 'cat', name: { en: 'Kucing', ms: 'Kucing', zh: '猫咪' }, main: '#f2a65a', accent: '#fff4e6', scale: 2.5, idle: 'bob', arrive: 'hop', horn: { wave: 'triangle', from: 700, to: 1100, ms: 350, repeat: 1 } },
  { id: 'tapir', name: { en: 'Malayan tapir', ms: 'Tapir', zh: '马来貘' }, main: '#26282c', accent: '#f4f4f2', scale: 2.5, idle: 'bob', arrive: 'hop', horn: { wave: 'triangle', from: 260, to: 200, ms: 400, repeat: 1 } },
  { id: 'tiger', name: { en: 'Tiger cub', ms: 'Anak harimau', zh: '小老虎' }, main: '#f28a1a', accent: '#1d1d1f', scale: 2.5, idle: 'bob', arrive: 'hop', horn: { wave: 'sawtooth', from: 320, to: 140, ms: 450, repeat: 1 } },
  { id: 'tehtarik', name: { en: 'Teh tarik cup', ms: 'Cawan teh tarik', zh: '拉茶杯' }, main: '#f7f3ea', accent: '#b5793f', scale: 2.5, idle: 'bounce', arrive: 'spin', horn: { wave: 'sine', from: 1320, to: 1320, ms: 220, repeat: 2 } },
];

export const ACCESSORIES: { id: AvatarAccessory; name: Text }[] = [
  { id: 'none', name: { en: 'None', ms: 'Tiada', zh: '无' } },
  { id: 'cap', name: { en: 'Cap', ms: 'Topi', zh: '帽子' } },
  { id: 'sunglasses', name: { en: 'Sunglasses', ms: 'Cermin mata hitam', zh: '墨镜' } },
  { id: 'flag', name: { en: 'Little flag', ms: 'Bendera kecil', zh: '小旗' } },
  { id: 'crown', name: { en: 'Crown', ms: 'Mahkota', zh: '皇冠' } },
];

/** Quick colour pairs [main, accent]. */
export const PALETTES: { name: Text; main: string; accent: string }[] = [
  { name: { en: 'Terus', ms: 'Terus', zh: 'Terus' }, main: '#1677ff', accent: '#22d3a5' },
  { name: { en: 'Pandan', ms: 'Pandan', zh: '班兰' }, main: '#3fae5a', accent: '#f7f3ea' },
  { name: { en: 'Sunset', ms: 'Senja', zh: '夕阳' }, main: '#ff6b4a', accent: '#ffd23f' },
  { name: { en: 'Night', ms: 'Malam', zh: '夜晚' }, main: '#2b3a55', accent: '#9ad1ff' },
  { name: { en: 'Bubblegum', ms: 'Gula-gula', zh: '泡泡糖' }, main: '#ff7eb6', accent: '#ffffff' },
];

export const DEFAULT_AVATAR: AvatarChoice = { body: 'car', main: '#f5f7fa', accent: '#1677ff', accessory: 'none', name: '', forAllModes: false };

export function presetFor(body: AvatarBody): AvatarPreset {
  return AVATAR_PRESETS.find((p) => p.id === body) ?? AVATAR_PRESETS[0];
}

/** Uploaded models are scaled to this length before the map scale (the car is ~4.6 m). */
export const UPLOAD_TARGET_LENGTH_M = 4.6;
export const UPLOAD_MAX_BYTES = 3 * 1024 * 1024;
export const UPLOAD_MAX_TRIANGLES = 20000;
export const NAME_MAX = 12;
