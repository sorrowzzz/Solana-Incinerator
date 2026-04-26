import {
  Keypair,
  PublicKey,
  SystemProgram,
  type Connection,
  type VersionedTransaction
} from '@solana/web3.js';
import type { AppSettings, IncinerateEvent } from '@shared/types';
import { getConnection } from './connection';
import { fetchOwnedTokenAccounts } from './enumerate';
import { buildActionsForWallet } from './instructions';
import { planBatches, compileInstructions, CU_PER_INSTRUCTION } from './batch';

/**
 * Don't bother attempting a sweep if the wallet has nothing in it. The
 * source wallet is *always* drained to exactly 0 lamports when there is
 * a balance — the fee payer pays the tx fee, so no reserve is needed.
 * Any non-zero residue below ~0.00089 SOL (rent-exempt minimum) would
 * cause "insufficient funds for rent" from the Solana runtime.
 */
const SWEEP_MIN_LAMPORTS = 1;
/** sendTransaction retry attempts on transient errors (blockhash, rate limits). */
const TX_SEND_MAX_ATTEMPTS = 5;
/** Base delay between retry attempts (ms); applied as exponential back-off. */
const TX_RETRY_BASE_DELAY_MS = 800;

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
  const connection = getConnection(settings.rpcUrl, settings.rpcRequestsPerSecond);

  emit({ type: 'run-started', runId, walletCount: walletKeypairs.length, at: Date.now() });

  const concurrency = Math.max(1, Math.min(8, settings.maxConcurrentWallets));
  let totalRecovered = 0;

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
  const blacklist = new Set(settings.mintBlacklist ?? []);
  const actions = buildActionsForWallet(accounts, {
    ownerPubkey: owner,
    destinationPubkey: destination,
    burnNonZeroBalances: settings.burnNonZeroBalances,
    closeEmptyAccounts: settings.closeEmptyAccounts,
    closeNftAccounts: settings.closeNftAccounts,
    mintBlacklist: blacklist
  });
  const batches = planBatches(actions);

  let closedAccountsForWallet = 0;
  let recoveredForWallet = 0;

  for (const batch of batches) {
    if (isCancelled()) break;

    const compute = batch.instructions.length * CU_PER_INSTRUCTION + 5_000;
    const result = await sendAndConfirmWithRetry({
      connection,
      payer: feePayer,
      signers: [feePayer, target],
      instructions: batch.instructions,
      priorityFeeMicroLamports: settings.priorityFeeMicroLamports,
      computeUnitsHint: compute,
      runId,
      walletIndex,
      emit
    });

    if (result.ok) {
      closedAccountsForWallet += batch.covers.length;
      recoveredForWallet += batch.covers.reduce((s, c) => s + c.account.lamports, 0);
    }
  }

  // Final step: sweep any remaining native SOL on the target wallet to the
  // destination. The fee payer pays the sweep tx fee, so we can sweep the
  // entire balance minus a tiny safety buffer.
  if (!isCancelled()) {
    try {
      const balance = await connection.getBalance(owner, 'confirmed');
      if (balance >= SWEEP_MIN_LAMPORTS) {
        // Sweep the entire balance. The fee payer pays the tx fee from a
        // different wallet, so the source can go to exactly 0 lamports —
        // which is the only way Solana lets a system-owned account end up
        // below rent-exempt minimum without erroring.
        const sweepAmount = balance;
        if (sweepAmount > 0) {
          const sweepIx = SystemProgram.transfer({
            fromPubkey: owner,
            toPubkey: destination,
            lamports: sweepAmount
          });
          const result = await sendAndConfirmWithRetry({
            connection,
            payer: feePayer,
            signers: [feePayer, target],
            instructions: [sweepIx],
            priorityFeeMicroLamports: settings.priorityFeeMicroLamports,
            computeUnitsHint: 10_000,
            runId,
            walletIndex,
            emit
          });
          if (result.ok) recoveredForWallet += sweepAmount;
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

interface SendArgs {
  connection: Connection;
  payer: Keypair;
  signers: Keypair[];
  instructions: Parameters<typeof compileInstructions>[2];
  priorityFeeMicroLamports: number;
  computeUnitsHint: number;
  runId: string;
  walletIndex: number;
  emit: EventEmitter;
}

async function sendAndConfirmWithRetry(args: SendArgs): Promise<{ ok: boolean; signature?: string }> {
  let lastError = 'unknown error';
  for (let attempt = 1; attempt <= TX_SEND_MAX_ATTEMPTS; attempt++) {
    let signature: string | undefined;
    try {
      const compiled = await compileInstructions(args.connection, args.payer.publicKey, args.instructions, {
        priorityFeeMicroLamports: args.priorityFeeMicroLamports,
        computeUnitsHint: args.computeUnitsHint
      });
      compiled.tx.sign(args.signers);

      signature = await sendRawTx(args.connection, compiled.tx);
      args.emit({
        type: 'tx-sent',
        runId: args.runId,
        walletIndex: args.walletIndex,
        signature,
        instructionsInTx: args.instructions.length,
        at: Date.now()
      });

      const conf = await args.connection.confirmTransaction(
        {
          signature,
          blockhash: compiled.recentBlockhash,
          lastValidBlockHeight: compiled.lastValidBlockHeight
        },
        'confirmed'
      );
      if (conf.value.err) {
        throw new Error(`confirmed with on-chain error: ${JSON.stringify(conf.value.err)}`);
      }

      args.emit({
        type: 'tx-confirmed',
        runId: args.runId,
        walletIndex: args.walletIndex,
        signature,
        at: Date.now()
      });
      return { ok: true, signature };
    } catch (e) {
      lastError = (e as Error).message;
      const transient =
        /blockhash|expired|too old|rate|too many|429|503|timeout|fetch failed/i.test(lastError);
      args.emit({
        type: 'tx-failed',
        runId: args.runId,
        walletIndex: args.walletIndex,
        signature,
        error: `attempt ${attempt}/${TX_SEND_MAX_ATTEMPTS}: ${lastError}`,
        at: Date.now()
      });
      if (attempt === TX_SEND_MAX_ATTEMPTS || !transient) break;
      // Exponential back-off so a Helius credit refill window has time to recover.
      await sleep(TX_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));
    }
  }
  return { ok: false };
}

async function sendRawTx(connection: Connection, tx: VersionedTransaction): Promise<string> {
  return connection.sendTransaction(tx, {
    skipPreflight: false,
    maxRetries: 5,
    preflightCommitment: 'confirmed'
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
