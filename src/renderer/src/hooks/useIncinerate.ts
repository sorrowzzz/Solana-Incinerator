import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppSettings, DryRunReport, IncinerateEvent } from '@shared/types';

export interface RunState {
  runId: string | null;
  events: IncinerateEvent[];
  active: boolean;
}

export function useIncinerate(): {
  run: RunState;
  dryRun: DryRunReport | null;
  busy: boolean;
  error: string | null;
  startDryRun: (walletSecrets: string[], settings: AppSettings) => Promise<void>;
  startLiveRun: (walletSecrets: string[], settings: AppSettings) => Promise<void>;
  cancelRun: () => void;
  clear: () => void;
} {
  const [run, setRun] = useState<RunState>({ runId: null, events: [], active: false });
  const [dryRun, setDryRun] = useState<DryRunReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    offRef.current = window.incineratorApi.incinerate.onEvent((e) => {
      setRun((prev) => {
        const next = { ...prev, events: [...prev.events, e] };
        if (e.type === 'run-completed' || e.type === 'run-cancelled') next.active = false;
        return next;
      });
    });
    return () => {
      offRef.current?.();
      offRef.current = null;
    };
  }, []);

  const startDryRun = useCallback(async (walletSecrets: string[], settings: AppSettings) => {
    setBusy(true);
    setError(null);
    setDryRun(null);
    try {
      const report = await window.incineratorApi.incinerate.dryRun({ walletSecrets, settings });
      setDryRun(report);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const startLiveRun = useCallback(async (walletSecrets: string[], settings: AppSettings) => {
    setBusy(true);
    setError(null);
    setRun({ runId: null, events: [], active: true });
    try {
      const { runId } = await window.incineratorApi.incinerate.run({ walletSecrets, settings });
      setRun((prev) => ({ ...prev, runId }));
    } catch (e) {
      setError((e as Error).message);
      setRun((prev) => ({ ...prev, active: false }));
    } finally {
      setBusy(false);
    }
  }, []);

  const cancelRun = useCallback(() => {
    if (run.runId) window.incineratorApi.incinerate.cancel(run.runId);
  }, [run.runId]);

  const clear = useCallback(() => {
    setRun({ runId: null, events: [], active: false });
    setDryRun(null);
    setError(null);
  }, []);

  return { run, dryRun, busy, error, startDryRun, startLiveRun, cancelRun, clear };
}
