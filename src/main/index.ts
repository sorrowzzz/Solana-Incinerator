import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { PublicKey } from '@solana/web3.js';
import { IPC } from '@shared/ipc-channels';
import { DEFAULT_SETTINGS, type AppSettings, type IncinerateEvent, type RunRequest } from '@shared/types';
import { registerSettingsHandlers, loadSettings } from './settings';
import { parseSecret, parseWalletsText, parseWalletsTextWithKeys, validatePubkey } from './wallet-parse';
import { generateDryRun } from './solana/dry-run';
import { startRun, type RunHandle } from './solana/incinerate';

let mainWindow: BrowserWindow | null = null;

/**
 * @solana/web3.js sometimes leaks rejected promises from internal RPC
 * polling fallbacks (especially under rate limiting). Those rejections are
 * already handled at our boundary via fetchWithRetry / sendAndConfirmWithRetry,
 * but the original promise still surfaces as an UnhandledPromiseRejection
 * scary stack trace in the terminal. Catch them here and log a single line.
 */
process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  if (/429|rate|too many|fetch failed|expired|blockhash/i.test(msg)) {
    // Quietly drop the noisy ones — the engine already handled them.
    return;
  }
  // Log non-rate-limit unhandled rejections so real bugs are still visible.
  // eslint-disable-next-line no-console
  console.warn('[unhandledRejection]', msg);
});

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
  registerIncinerateHandlers();
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

const activeRuns = new Map<string, RunHandle>();

function emitIncinerateEvent(event: IncinerateEvent): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(IPC.INCINERATE_EVENT, event);
}

function registerIncinerateHandlers(): void {
  ipcMain.handle(IPC.INCINERATE_DRY_RUN, async (_event, req: RunRequest) => {
    const parsed = parseWalletsTextWithKeys(req.walletSecrets.join('\n'));
    const ok = parsed.filter((w) => w.ok && w.keypair);
    const feePayerParsed = parseSecret(req.settings.feePayerSecret);
    if (!feePayerParsed.ok || !feePayerParsed.keypair) {
      throw new Error(`fee payer secret is invalid: ${feePayerParsed.reason}`);
    }
    const destinationCheck = validatePubkey(req.settings.destinationAddress);
    if (!destinationCheck.ok) {
      throw new Error(`destination address is invalid: ${destinationCheck.reason}`);
    }
    return generateDryRun(
      ok.map((w) => ({ pubkey: w.pubkey })),
      req.settings,
      feePayerParsed.keypair.publicKey
    );
  });

  ipcMain.handle(IPC.INCINERATE_RUN, async (_event, req: RunRequest) => {
    const parsed = parseWalletsTextWithKeys(req.walletSecrets.join('\n'));
    const ok = parsed.filter((w) => w.ok && w.keypair);
    const feePayerParsed = parseSecret(req.settings.feePayerSecret);
    if (!feePayerParsed.ok || !feePayerParsed.keypair) {
      throw new Error(`fee payer secret is invalid: ${feePayerParsed.reason}`);
    }
    const destinationCheck = validatePubkey(req.settings.destinationAddress);
    if (!destinationCheck.ok) {
      throw new Error(`destination address is invalid: ${destinationCheck.reason}`);
    }

    const handle = startRun(
      {
        walletKeypairs: ok.map((w) => w.keypair!),
        feePayer: feePayerParsed.keypair,
        destination: new PublicKey(req.settings.destinationAddress),
        settings: req.settings
      },
      emitIncinerateEvent
    );
    activeRuns.set(handle.runId, handle);
    void handle.promise.finally(() => activeRuns.delete(handle.runId));
    return { runId: handle.runId };
  });

  ipcMain.handle(IPC.INCINERATE_CANCEL, (_event, runId: string) => {
    const h = activeRuns.get(runId);
    if (h) h.cancel();
  });
}

// Re-export for type-checker convenience
export type { AppSettings };
export { DEFAULT_SETTINGS, loadSettings };
