// Reads private settings from .env.local.
// Vite only exposes variables that start with "VITE_" to the browser.

const rawToken = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

export type TokenStatus =
  | { ok: true; token: string }
  | { ok: false; reason: 'missing' | 'placeholder' | 'secret' | 'invalid' };

export function getMapboxToken(): TokenStatus {
  const token = rawToken?.trim();
  if (!token) return { ok: false, reason: 'missing' };
  if (token.includes('paste_your_token')) return { ok: false, reason: 'placeholder' };
  // Secret tokens (sk.) must NEVER be used in a website - anyone could steal them.
  if (token.startsWith('sk.')) return { ok: false, reason: 'secret' };
  if (!token.startsWith('pk.')) return { ok: false, reason: 'invalid' };
  return { ok: true, token };
}

/**
 * Optional: Geoapify key for OpenStreetMap street / neighbourhood search (free plan,
 * 3,000 requests per day). If it is missing, search simply uses Mapbox only.
 */
export function getGeoapifyKey(): string | null {
  const key = (import.meta.env.VITE_GEOAPIFY_KEY as string | undefined)?.trim();
  return key && !key.includes('paste_your') ? key : null;
}
