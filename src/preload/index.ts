import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC } from '@shared/ipc-channels';
import type { AppSettings, IncinerateEvent, RunRequest, DryRunReport } from '@shared/types';

const api = {
  getAppVersion: (): Promise<string> => ipcRenderer.invoke(IPC.APP_VERSION),

  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_GET),
    set: (next: AppSettings): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_SET, next)
  },

  wallets: {
    openDialog: (): Promise<{ canceled: true } | { canceled: false; filePath: string; text: string }> =>
      ipcRenderer.invoke(IPC.WALLETS_OPEN_DIALOG),
    parseText: (text: string): Promise<unknown> => ipcRenderer.invoke(IPC.WALLETS_PARSE_TEXT, text)
  },

  validate: {
    pubkey: (value: string): Promise<{ ok: boolean; reason?: string }> =>
      ipcRenderer.invoke(IPC.VALIDATE_PUBKEY, value),
    secret: (value: string): Promise<{ ok: boolean; pubkey?: string; reason?: string }> =>
      ipcRenderer.invoke(IPC.VALIDATE_SECRET, value)
  },

  incinerate: {
    dryRun: (req: RunRequest): Promise<DryRunReport> => ipcRenderer.invoke(IPC.INCINERATE_DRY_RUN, req),
    run: (req: RunRequest): Promise<{ runId: string }> => ipcRenderer.invoke(IPC.INCINERATE_RUN, req),
    cancel: (runId: string): Promise<void> => ipcRenderer.invoke(IPC.INCINERATE_CANCEL, runId),
    onEvent: (handler: (e: IncinerateEvent) => void): (() => void) => {
      const listener = (_evt: IpcRendererEvent, e: IncinerateEvent): void => handler(e);
      ipcRenderer.on(IPC.INCINERATE_EVENT, listener);
      return () => ipcRenderer.removeListener(IPC.INCINERATE_EVENT, listener);
    }
  },

  shell: {
    openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke(IPC.OPEN_EXTERNAL, url)
  }
};

contextBridge.exposeInMainWorld('incineratorApi', api);

export type IncineratorApi = typeof api;
