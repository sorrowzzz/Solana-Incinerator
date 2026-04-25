import { Keypair, PublicKey } from '@solana/web3.js';
import type { AppSettings, DryRunReport, DryRunWalletReport } from '@shared/types';
import { getConnection } from './connection';
import { fetchOwnedTokenAccounts } from './enumerate';
import { buildActionsForWallet } from './instructions';
import { planBatches } from './batch';

const FEE_PER_SIGNATURE_LAMPORTS = 5_000;

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
  const connection = getConnection(settings.rpcUrl);
  const destination = new PublicKey(settings.destinationAddress);

  const walletReports: DryRunWalletReport[] = [];

  for (const w of wallets) {
    const owner = new PublicKey(w.pubkey);
    try {
      const accounts = await fetchOwnedTokenAccounts(connection, owner);
      const actions = buildActionsForWallet(accounts, {
        ownerPubkey: owner,
        destinationPubkey: destination,
        burnNonZeroBalances: settings.burnNonZeroBalances,
        closeEmptyAccounts: settings.closeEmptyAccounts,
        closeNftAccounts: settings.closeNftAccounts
      });

      const closeable = actions.filter((a) => !a.skipped);
      const batches = planBatches(actions);

      const recoveredLamports = closeable.reduce((sum, a) => sum + a.account.lamports, 0);
      // Each batch is signed by [feePayer, ownerWallet] = 2 signatures.
      const txCount = batches.length;
      const feesLamports = txCount * 2 * FEE_PER_SIGNATURE_LAMPORTS;
      // priority fee is computed at compute-unit time; included as a
      // best-effort add-on so the GUI gives an honest preview.
      const priorityFeeLamports =
        settings.priorityFeeMicroLamports > 0
          ? Math.ceil((settings.priorityFeeMicroLamports * 200_000 * txCount) / 1_000_000)
          : 0;

      const totalFees = feesLamports + priorityFeeLamports;
      const netLamports = Math.max(0, recoveredLamports - totalFees);

      const notes: string[] = [];
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
        error: (e as Error).message
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
