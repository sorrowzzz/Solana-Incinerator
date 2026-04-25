import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/types';

export function useSettings(): {
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
  patch: (p: Partial<AppSettings>) => void;
  loaded: boolean;
} {
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    window.incineratorApi.settings
      .get()
      .then((s) => {
        if (alive) {
          setSettingsState(s);
          setLoaded(true);
        }
      })
      .catch(() => setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  const setSettings = useCallback((next: AppSettings) => {
    setSettingsState(next);
    window.incineratorApi.settings.set(next).catch(() => {
      /* persistence is best-effort; in-memory copy is the source of truth */
    });
  }, []);

  const patch = useCallback(
    (p: Partial<AppSettings>) => {
      setSettings({ ...settings, ...p });
    },
    [settings, setSettings]
  );

  return { settings, setSettings, patch, loaded };
}
