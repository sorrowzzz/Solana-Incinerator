import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  type Connection,
  type TransactionInstruction
} from '@solana/web3.js';
import type { AppSettings, IncinerateEvent } from '@shared/types';
import { getConnection } from './connection';
import { fetchOwnedTokenAccounts } from './enumerate';
import { buildActionsForWallet } from './instructions';
import { planBatches, compileBatch } from './batch';

const FEE_PER_SIGNATURE_LAMPORTS = 5_000;
/** Buffer so the final SOL sweep doesn't fail by exactly the tx fee. */
const SWEEP_FEE_BUFFER_LAMPORTS = 5_000;
/** Don't bother sweeping dust below this many lamports. */
const SWEEP_MIN_LAMPORTS = 1_000;

export type EventEmitter = (event: IncinerateEvent) => void;

export interface RunInput {
  walletKeypairs: Keypair[];
  feePayer: Keypair;
  destination: PublicKey;
  settings: AppSettings;
}

export interface RunHandle {
  runId: string;
  cancel: () => void;
  promise: Promise<{ totalRecoveredLamports: number; cancelled: boolean }>;
}

export function startRun(input: RunInput, emit: EventEmitter): RunHandle {
  const runId = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  let cancelled = false;
  const cancel = (): void => {
    cancelled = true;
  };
  const promise = executeRun(runId, input, emit, () => cancelled);
  return { runId, cancel, promise };
}

async function executeRun(
  runId: string,
  input: RunInput,
  emit: EventEmitter,
  isCancelled: () => boolean
): Promise<{ totalRecoveredLamports: number; cancelled: boolean }> {
  const { walletKeypairs, feePayer, destination, settings } = input;
  const connection = getConnection(settings.rpcUrl);

  emit({ type: 'run-started', runId, walletCount: walletKeypairs.length, at: Date.now() });

  const concurrency = Math.max(1, Math.min(8, settings.maxConcurrentWallets));
  let totalRecovered = 0;

  // Simple worker pool: map walletKeypairs through a bounded queue.
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      if (isCancelled()) return;
      const idx = cursor++;
      if (idx >= walletKeypairs.length) return;
      const target = walletKeypairs[idx];
      try {
        const recovered = await processWallet(
          connection,
          runId,
          idx,
          target,
          feePayer,
          destination,
          settings,
          emit,
          isCancelled
        );
        totalRecovered += recovered;
      } catch (e) {
        emit({
          type: 'wallet-failed',
          runId,
          walletIndex: idx,
          pubkey: target.publicKey.toBase58(),
          error: (e as Error).message,
          at: Date.now()
        });
      }
    }
  });

  await Promise.all(workers);

  if (isCancelled()) {
    emit({ type: 'run-cancelled', runId, at: Date.now() });
    return { totalRecoveredLamports: totalRecovered, cancelled: true };
  }
  emit({
    type: 'run-completed',
    runId,
    totalRecoveredLamports: totalRecovered,
    at: Date.now()
  });
  return { totalRecoveredLamports: totalRecovered, cancelled: false };
}

async function processWallet(
  connection: Connection,
  runId: string,
  walletIndex: number,
  target: Keypair,
  feePayer: Keypair,
  destination: PublicKey,
  settings: AppSettings,
  emit: EventEmitter,
  isCancelled: () => boolean
): Promise<number> {
  const owner = target.publicKey;
  emit({ type: 'wallet-started', runId, walletIndex, pubkey: owner.toBase58(), at: Date.now() });

  const accounts = await fetchOwnedTokenAccounts(connection, owner);
  const actions = buildActionsForWallet(accounts, {
    ownerPubkey: owner,
    destinationPubkey: destination,
    burnNonZeroBalances: settings.burnNonZeroBalances,
    closeEmptyAccounts: settings.closeEmptyAccounts,
    closeNftAccounts: settings.closeNftAccounts
  });
  const batches = planBatches(actions);

  let closedAccountsForWallet = 0;
  let recoveredForWallet = 0;

  for (const batch of batches) {
    if (isCancelled()) break;

    const ixs = [...batch.instructions];
    if (settings.priorityFeeMicroLamports > 0) {
      ixs.unshift(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: settings.priorityFeeMicroLamports }));
    }

    const compiled = await compileBatchWithIxs(connection, feePayer.publicKey, ixs);
    compiled.tx.sign([feePayer, target]);

    let signature: string | undefined;
    try {
      signature = await connection.sendTransaction(compiled.tx, {
        skipPreflight: false,
        maxRetries: 3
      });
      emit({
        type: 'tx-sent',
        runId,
        walletIndex,
        signature,
        instructionsInTx: batch.instructions.length,
        at: Date.now()
      });

      const conf = await connection.confirmTransaction(
        {
          signature,
          blockhash: compiled.recentBlockhash,
          lastValidBlockHeight: compiled.lastValidBlockHeight
        },
        'confirmed'
      );
      if (conf.value.err) {
        throw new Error(`tx confirmed with error: ${JSON.stringify(conf.value.err)}`);
      }

      emit({ type: 'tx-confirmed', runId, walletIndex, signature, at: Date.now() });
      closedAccountsForWallet += batch.covers.length;
      recoveredForWallet += batch.covers.reduce((s, c) => s + c.account.lamports, 0);
    } catch (e) {
      emit({
        type: 'tx-failed',
        runId,
        walletIndex,
        signature,
        error: (e as Error).message,
        at: Date.now()
      });
      // Continue with the next batch — partial progress is fine.
    }
  }

  // Final step: sweep any remaining native SOL on the target wallet to the
  // destination. The fee payer pays the sweep tx fee, so we can sweep the
  // entire balance minus a tiny safety buffer.
  if (!isCancelled()) {
    try {
      const balance = await connection.getBalance(owner, 'confirmed');
      if (balance > SWEEP_MIN_LAMPORTS) {
        const sweepAmount = Math.max(0, balance - SWEEP_FEE_BUFFER_LAMPORTS);
        if (sweepAmount > 0) {
          const sweepIx = SystemProgram.transfer({
            fromPubkey: owner,
            toPubkey: destination,
            lamports: sweepAmount
          });
          const compiled = await compileBatchWithIxs(connection, feePayer.publicKey, [sweepIx]);
          compiled.tx.sign([feePayer, target]);
          const sig = await connection.sendTransaction(compiled.tx, { skipPreflight: false, maxRetries: 3 });
          emit({ type: 'tx-sent', runId, walletIndex, signature: sig, instructionsInTx: 1, at: Date.now() });
          const conf = await connection.confirmTransaction(
            { signature: sig, blockhash: compiled.recentBlockhash, lastValidBlockHeight: compiled.lastValidBlockHeight },
            'confirmed'
          );
          if (!conf.value.err) {
            emit({ type: 'tx-confirmed', runId, walletIndex, signature: sig, at: Date.now() });
            recoveredForWallet += sweepAmount;
          } else {
            emit({
              type: 'tx-failed',
              runId,
              walletIndex,
              signature: sig,
              error: `sweep tx errored: ${JSON.stringify(conf.value.err)}`,
              at: Date.now()
            });
          }
        }
      }
    } catch (e) {
      emit({
        type: 'log',
        runId,
        level: 'warn',
        message: `sweep step skipped for wallet ${owner.toBase58()}: ${(e as Error).message}`,
        at: Date.now()
      });
    }
  }

  emit({
    type: 'wallet-completed',
    runId,
    walletIndex,
    pubkey: owner.toBase58(),
    recoveredLamports: recoveredForWallet,
    closedAccounts: closedAccountsForWallet,
    at: Date.now()
  });

  return recoveredForWallet;
}

async function compileBatchWithIxs(
  connection: Connection,
  payer: PublicKey,
  instructions: TransactionInstruction[]
): Promise<{ tx: VersionedTransaction; recentBlockhash: string; lastValidBlockHeight: number }> {
  const latest = await connection.getLatestBlockhash('confirmed');
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: latest.blockhash,
    instructions
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  return { tx, recentBlockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight };
}

// Re-export to keep batch.compileBatch callable for code that wants the
// pre-built BatchPlan path; we only used the raw-ix path above.
export { compileBatch } from './batch';
