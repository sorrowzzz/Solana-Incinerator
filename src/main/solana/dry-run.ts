import { Keypair, PublicKey } from '@solana/web3.js';
import type { AppSettings, DryRunReport, DryRunWalletReport } from '@shared/types';
import { getConnection } from './connection';
import { fetchOwnedTokenAccounts } from './enumerate';
import { buildActionsForWallet } from './instructions';
import { planBatches, CU_PER_INSTRUCTION } from './batch';

const FEE_PER_SIGNATURE_LAMPORTS = 5_000;
/** Per-tx 2 signers (fee payer + owner) → 2 base fees. */
const SIGNERS_PER_TX = 2;

interface WalletInput {
  pubkey: string;
  /** Only present in main process; used here to derive pubkey if needed. */
  keypair?: Keypair;
}

export async function generateDryRun(
  wallets: WalletInput[],
  settings: AppSettings,
  feePayerPubkey: PublicKey
): Promise<DryRunReport> {
  const connection = getConnection(settings.rpcUrl, settings.rpcRequestsPerSecond);
  const destination = new PublicKey(settings.destinationAddress);

  const walletReports: DryRunWalletReport[] = [];

  const blacklist = new Set(settings.mintBlacklist ?? []);

  for (const w of wallets) {
    const owner = new PublicKey(w.pubkey);
    try {
      const [accounts, walletBalance] = await Promise.all([
        fetchWithRetry(() => fetchOwnedTokenAccounts(connection, owner)),
        fetchWithRetry(() => connection.getBalance(owner, 'confirmed'))
      ]);
      const actions = buildActionsForWallet(accounts, {
        ownerPubkey: owner,
        destinationPubkey: destination,
        burnNonZeroBalances: settings.burnNonZeroBalances,
        closeEmptyAccounts: settings.closeEmptyAccounts,
        closeNftAccounts: settings.closeNftAccounts,
        mintBlacklist: blacklist
      });

      const closeable = actions.filter((a) => !a.skipped);
      const batches = planBatches(actions);

      const rentLamports = closeable.reduce((sum, a) => sum + a.account.lamports, 0);
      const recoveredLamports = rentLamports + walletBalance;
      // Each batch is signed by [feePayer, ownerWallet] = SIGNERS_PER_TX signatures.
      const closeTxCount = batches.length;
      // Plus one final sweep tx to move remaining native SOL — only when
      // there is actually a balance to sweep.
      const sweepTxCount = walletBalance >= 1 ? 1 : 0;
      const txCount = closeTxCount + sweepTxCount;
      const feesLamports = txCount * SIGNERS_PER_TX * FEE_PER_SIGNATURE_LAMPORTS;
      // Priority fee approximation: cu_price (μλ/CU) × budgeted CU / 1e6, summed over txs.
      const priorityFeeLamports =
        settings.priorityFeeMicroLamports > 0
          ? batches.reduce(
              (sum, b) =>
                sum +
                Math.ceil(
                  (settings.priorityFeeMicroLamports *
                    (b.instructions.length * CU_PER_INSTRUCTION + 5_000)) /
                    1_000_000
                ),
              0
            ) +
            (sweepTxCount > 0
              ? Math.ceil((settings.priorityFeeMicroLamports * 10_000) / 1_000_000)
              : 0)
          : 0;

      const totalFees = feesLamports + priorityFeeLamports;
      const netLamports = Math.max(0, recoveredLamports - totalFees);

      const notes: string[] = [];
      if (walletBalance > 0) {
        notes.push(`includes native SOL sweep of ${(walletBalance / 1_000_000_000).toFixed(6)} SOL`);
      }
      const skipped = actions.filter((a) => a.skipped);
      if (skipped.length > 0) {
        const counts: Record<string, number> = {};
        for (const s of skipped) counts[s.skipReason ?? 'unknown'] = (counts[s.skipReason ?? 'unknown'] ?? 0) + 1;
        for (const [reason, n] of Object.entries(counts)) {
          notes.push(`${n} account(s) skipped: ${reason}`);
        }
      }

      walletReports.push({
        pubkey: w.pubkey,
        tokenAccountCount: accounts.length,
        closeableAccountCount: closeable.length,
        estimatedRecoveredLamports: recoveredLamports,
        estimatedFeesLamports: totalFees,
        estimatedNetLamports: netLamports,
        notes,
        ok: true
      });
    } catch (e) {
      walletReports.push({
        pubkey: w.pubkey,
        tokenAccountCount: 0,
        closeableAccountCount: 0,
        estimatedRecoveredLamports: 0,
        estimatedFeesLamports: 0,
        estimatedNetLamports: 0,
        notes: [],
        ok: false,
        error: classifyRpcError(e as Error)
      });
    }
  }

  const totalCloseableAccounts = walletReports.reduce((s, w) => s + w.closeableAccountCount, 0);
  const totalEstimatedRecoveredLamports = walletReports.reduce((s, w) => s + w.estimatedRecoveredLamports, 0);
  const totalEstimatedFeesLamports = walletReports.reduce((s, w) => s + w.estimatedFeesLamports, 0);
  const totalEstimatedNetLamports = walletReports.reduce((s, w) => s + w.estimatedNetLamports, 0);

  return {
    walletReports,
    totalCloseableAccounts,
    totalEstimatedRecoveredLamports,
    totalEstimatedFeesLamports,
    totalEstimatedNetLamports,
    destinationAddress: destination.toBase58(),
    feePayerPubkey: feePayerPubkey.toBase58(),
    rpcUrl: settings.rpcUrl,
    generatedAt: Date.now()
  };
}

async function fetchWithRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastError: Error | undefined;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e as Error;
      const transient = /fetch failed|429|too many|503|timeout|rate|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(
        lastError.message
      );
      if (i === attempts || !transient) throw lastError;
      // Exponential back-off: 800ms, 1.6s, 3.2s, 6.4s. Combined with the
      // RpcGate this is enough to weather a Helius credit refill window.
      await new Promise((r) => setTimeout(r, 800 * Math.pow(2, i - 1)));
    }
  }
  throw lastError;
}

function classifyRpcError(e: Error): string {
  const msg = e.message || String(e);
  if (/fetch failed|ECONNRESET|ENOTFOUND|EAI_AGAIN/i.test(msg)) {
    return `RPC unreachable. The public mainnet endpoint heavily rate-limits getParsedTokenAccountsByOwner — sign up for a free Helius RPC at https://helius.dev and paste the URL into RPC URL. (raw: ${msg})`;
  }
  if (/429|rate/i.test(msg)) {
    return `RPC rate-limited (HTTP 429). Switch to Helius/Triton/QuickNode. (raw: ${msg})`;
  }
  if (/403|Forbidden/i.test(msg)) {
    return `RPC refused the request (HTTP 403) — public mainnet often blocks getParsedTokenAccountsByOwner. Use a Helius RPC URL. (raw: ${msg})`;
  }
  return msg;
}
