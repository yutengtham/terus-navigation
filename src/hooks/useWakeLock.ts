import { useEffect } from 'react';

type WakeLockSentinelLike = { release: () => Promise<void> };
type NavigatorWithWakeLock = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } };

/**
 * Keeps the phone screen on while navigating (Screen Wake Lock API).
 * Web apps can't run navigation with the screen off, so this matters.
 * Supported in Chrome/Android and Safari 16.4+; silently does nothing elsewhere.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const nav = navigator as NavigatorWithWakeLock;
    if (!nav.wakeLock) return;
    let lock: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        lock = await nav.wakeLock!.request('screen');
        if (cancelled) lock.release();
      } catch {
        /* e.g. battery saver - nothing we can do */
      }
    };
    // The browser drops the lock when the app is hidden; take it again when it comes back.
    const onVisible = () => {
      if (document.visibilityState === 'visible') request();
    };

    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
