export interface AppSettings {
  rpcUrl: string;
  destinationAddress: string;
  feePayerSecret: string;
  burnNonZeroBalances: boolean;
  closeEmptyAccounts: boolean;
  closeNftAccounts: boolean;
  maxConcurrentWallets: number;
  priorityFeeMicroLamports: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  destinationAddress: '',
  feePayerSecret: '',
  burnNonZeroBalances: true,
  closeEmptyAccounts: true,
  closeNftAccounts: true,
  maxConcurrentWallets: 4,
  priorityFeeMicroLamports: 0
};

export interface ParsedWallet {
  /** 1-based line number in the source file */
  line: number;
  /** Public key in base58 */
  pubkey: string;
  /** Format the secret was provided in */
  format: 'base58' | 'json-array';
  /** Whether parsing succeeded */
  ok: boolean;
  /** Reason if !ok */
  error?: string;
}

export interface DryRunWalletReport {
  pubkey: string;
  tokenAccountCount: number;
  closeableAccountCount: number;
  estimatedRecoveredLamports: number;
  estimatedFeesLamports: number;
  estimatedNetLamports: number;
  notes: string[];
  ok: boolean;
  error?: string;
}

export interface DryRunReport {
  walletReports: DryRunWalletReport[];
  totalCloseableAccounts: number;
  totalEstimatedRecoveredLamports: number;
  totalEstimatedFeesLamports: number;
  totalEstimatedNetLamports: number;
  destinationAddress: string;
  feePayerPubkey: string;
  rpcUrl: string;
  generatedAt: number;
}

export type IncinerateEvent =
  | { type: 'run-started'; runId: string; walletCount: number; at: number }
  | { type: 'wallet-started'; runId: string; walletIndex: number; pubkey: string; at: number }
  | { type: 'tx-sent'; runId: string; walletIndex: number; signature: string; instructionsInTx: number; at: number }
  | { type: 'tx-confirmed'; runId: string; walletIndex: number; signature: string; at: number }
  | { type: 'tx-failed'; runId: string; walletIndex: number; signature?: string; error: string; at: number }
  | { type: 'wallet-completed'; runId: string; walletIndex: number; pubkey: string; recoveredLamports: number; closedAccounts: number; at: number }
  | { type: 'wallet-failed'; runId: string; walletIndex: number; pubkey: string; error: string; at: number }
  | { type: 'run-completed'; runId: string; totalRecoveredLamports: number; at: number }
  | { type: 'run-cancelled'; runId: string; at: number }
  | { type: 'log'; runId: string; level: 'info' | 'warn' | 'error'; message: string; at: number };

export interface RunRequest {
  walletSecrets: string[];
  settings: AppSettings;
}
