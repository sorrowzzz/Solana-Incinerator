import { app, ipcMain } from 'electron';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { IPC } from '@shared/ipc-channels';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/types';

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

/**
 * Persisted settings exclude any private-key material. Fee-payer secret and
 * destination address may contain user-controlled secrets we deliberately
 * choose NOT to write to disk.
 */
const PERSIST_KEYS: (keyof AppSettings)[] = [
  'rpcUrl',
  'destinationAddress',
  'burnNonZeroBalances',
  'closeEmptyAccounts',
  'closeNftAccounts',
  'maxConcurrentWallets',
  'priorityFeeMicroLamports'
];

export function loadSettings(): AppSettings {
  const path = settingsPath();
  if (!existsSync(path)) return { ...DEFAULT_SETTINGS };
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed, feePayerSecret: '' };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(next: AppSettings): void {
  const path = settingsPath();
  mkdirSync(dirname(path), { recursive: true });
  const persisted: Partial<AppSettings> = {};
  for (const key of PERSIST_KEYS) {
    (persisted[key] as AppSettings[typeof key]) = next[key];
  }
  writeFileSync(path, JSON.stringify(persisted, null, 2), 'utf-8');
}

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC.SETTINGS_GET, () => loadSettings());
  ipcMain.handle(IPC.SETTINGS_SET, (_event, next: AppSettings) => {
    saveSettings(next);
    return loadSettings();
  });
}
