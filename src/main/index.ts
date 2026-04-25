import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { IPC } from '@shared/ipc-channels';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/types';
import { registerSettingsHandlers, loadSettings } from './settings';
import { parseSecret, parseWalletsText, validatePubkey } from './wallet-parse';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'Solana Incinerator',
    backgroundColor: '#0b0d10',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.sorrowz.solana-incinerator');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  registerSettingsHandlers();
  registerWalletHandlers();
  registerValidationHandlers();
  registerMiscHandlers();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function registerWalletHandlers(): void {
  ipcMain.handle(IPC.WALLETS_OPEN_DIALOG, async () => {
    if (!mainWindow) return { canceled: true };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select wallets file',
      properties: ['openFile'],
      filters: [
        { name: 'Wallet list', extensions: ['txt'] },
        { name: 'All files', extensions: ['*'] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) return { canceled: true };
    const filePath = result.filePaths[0];
    const text = readFileSync(filePath, 'utf-8');
    return { canceled: false, filePath, text };
  });

  ipcMain.handle(IPC.WALLETS_PARSE_TEXT, (_event, text: string) => {
    return parseWalletsText(text);
  });
}

function registerValidationHandlers(): void {
  ipcMain.handle(IPC.VALIDATE_PUBKEY, (_event, value: string) => {
    return validatePubkey(value);
  });
  ipcMain.handle(IPC.VALIDATE_SECRET, (_event, value: string) => {
    const r = parseSecret(value);
    if (!r.ok) return { ok: false, reason: r.reason };
    return { ok: true, pubkey: r.pubkey };
  });
}

function registerMiscHandlers(): void {
  ipcMain.handle(IPC.OPEN_EXTERNAL, async (_event, url: string) => {
    if (!/^https:\/\//.test(url)) return false;
    await shell.openExternal(url);
    return true;
  });
  ipcMain.handle(IPC.APP_VERSION, () => app.getVersion());
}

// Re-export for type-checker convenience
export type { AppSettings };
export { DEFAULT_SETTINGS, loadSettings };
