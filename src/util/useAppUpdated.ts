import { useEffect, useState } from 'react';

/**
 * True once a newer deploy's service worker has taken over this page. The page keeps running the
 * old code until it reloads, so the app shows a "tap to refresh" banner instead of reloading
 * mid-scan. Also asks for an update whenever the app comes back to the foreground.
 */
export function useAppUpdated(): boolean {
  const [updated, setUpdated] = useState(false);
  useEffect(() => {
    const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
    if (!sw) return;
    const hadController = !!sw.controller; // first install is not an update
    const onChange = () => hadController && setUpdated(true);
    const onVisible = () => {
      if (document.visibilityState === 'visible') sw.getRegistration().then((r) => r?.update()).catch(() => {});
    };
    sw.addEventListener('controllerchange', onChange);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      sw.removeEventListener('controllerchange', onChange);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return updated;
}
