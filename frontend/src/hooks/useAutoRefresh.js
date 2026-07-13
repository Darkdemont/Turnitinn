import { useEffect } from 'react';

export default function useAutoRefresh(callback, intervalMs = 15000) {
  useEffect(() => {
    function run() {
      try {
        Promise.resolve(callback()).catch(() => {});
      } catch {
        // Background refresh failures are silent; the next tick will retry.
      }
    }

    const intervalId = window.setInterval(run, intervalMs);

    function refreshWhenVisible() {
      if (!document.hidden) {
        run();
      }
    }

    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [callback, intervalMs]);
}
