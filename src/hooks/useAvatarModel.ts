import { useEffect, useState } from 'react';
import type { AvatarChoice } from '../config/avatars';
import { avatarScale, buildAvatarGlb } from '../services/avatarModels';
import type { AvatarModel } from '../services/mapLayers';
import { idbGet } from '../utils/idb';

export const UPLOAD_KEY = 'avatar.upload';

const cache = new Map<string, string>(); // choice key -> blob URL (kept for the session)

function keyOf(c: AvatarChoice): string {
  return c.body === 'upload' ? `upload:${c.name}` : [c.body, c.main, c.accent, c.accessory].join('|');
}

/** Builds (or loads) the .glb for an avatar choice. Classic car / failures -> null (use the built-in model). */
export async function loadAvatarModel(choice: AvatarChoice): Promise<AvatarModel | null> {
  if (choice.body === 'car') return null;
  const key = keyOf(choice);
  let uri = choice.body === 'upload' ? undefined : cache.get(key);
  if (!uri) {
    const buf = choice.body === 'upload' ? await idbGet<ArrayBuffer>(UPLOAD_KEY) : buildAvatarGlb(choice);
    if (!buf) return null;
    uri = URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' }));
    if (choice.body !== 'upload') cache.set(key, uri);
  }
  return { uri, scale: avatarScale(choice.body) };
}

/**
 * The model to draw for the current travel mode: the avatar when driving (or for every mode if
 * the user chose so); undefined while loading, null = the built-in car / walker / bicycle.
 */
export function useAvatarModel(choice: AvatarChoice, travelMode: 'driving' | 'walking' | 'cycling'): AvatarModel | null | undefined {
  const use = travelMode === 'driving' || choice.forAllModes;
  const [model, setModel] = useState<AvatarModel | null | undefined>(use && choice.body !== 'car' ? undefined : null);
  const key = use ? keyOf(choice) : 'none';
  useEffect(() => {
    if (!use) {
      setModel(null);
      return;
    }
    let alive = true;
    void loadAvatarModel(choice).then((m) => alive && setModel(m));
    return () => {
      alive = false;
    };
    // `key` covers every field that changes the model.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return model;
}
