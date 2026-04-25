export const IPC = {
  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Wallet file
  WALLETS_OPEN_DIALOG: 'wallets:open-dialog',
  WALLETS_PARSE_TEXT: 'wallets:parse-text',

  // Validation
  VALIDATE_PUBKEY: 'validate:pubkey',
  VALIDATE_SECRET: 'validate:secret',

  // Incinerate
  INCINERATE_DRY_RUN: 'incinerate:dry-run',
  INCINERATE_RUN: 'incinerate:run',
  INCINERATE_CANCEL: 'incinerate:cancel',

  // Streamed events (main -> renderer)
  INCINERATE_EVENT: 'incinerate:event',

  // Misc
  OPEN_EXTERNAL: 'shell:open-external',
  APP_VERSION: 'app:version'
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
