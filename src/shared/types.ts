export interface AppSettings {
  rpcUrl: string;
  destinationAddress: string;
  feePayerSecret: string;
  burnNonZeroBalances: boolean;
  closeEmptyAccounts: boolean;
  closeNftAccounts: boolean;
  maxConcurrentWallets: number;
  priorityFeeMicroLamports: number;
  /**
   * Mint addresses that must NEVER be touched, even if they appear in the
   * wallet's token-account list. Defaults guard against accidentally
   * closing major-stablecoin or wSOL accounts that hold value.
   */
  mintBlacklist: string[];
  /**
   * Hard ceiling on outbound JSON-RPC calls per second. Helius free tier
   * is ~10 RPS; default 8 leaves headroom. Set to 0 to disable.
   */
  rpcRequestsPerSecond: number;
}

/**
 * Default mint blacklist — never burn or close these mints by default.
 *  - USDC mainnet  (EPjFW...) — Circle's USDC
 *  - USDT mainnet  (Es9vM...) — Tether USDT
 * wSOL is handled separately (close unwraps balance + rent into destination,
 * which is the desired behaviour) so it is intentionally not blacklisted.
 */
export const DEFAULT_MINT_BLACKLIST = [
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
];

export const DEFAULT_SETTINGS: AppSettings = {
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  destinationAddress: '',
  feePayerSecret: '',
  burnNonZeroBalances: true,
  closeEmptyAccounts: true,
  closeNftAccounts: true,
  maxConcurrentWallets: 4,
  priorityFeeMicroLamports: 0,
  mintBlacklist: [...DEFAULT_MINT_BLACKLIST],
  rpcRequestsPerSecond: 8
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
