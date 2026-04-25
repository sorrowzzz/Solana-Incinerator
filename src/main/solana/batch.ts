import {
  TransactionMessage,
  VersionedTransaction,
  type PublicKey,
  type TransactionInstruction,
  type Connection
} from '@solana/web3.js';
import type { AccountActions } from './instructions';

/**
 * Maximum instructions per transaction. Solana's hard tx-size limit is 1232
 * bytes including signatures and the message header. A single Burn+Close
 * pair is ~150 bytes; Close-only is ~80 bytes. We keep a conservative cap
 * and let serialise-time validation reject any pack that overflowed in
 * the rare case of an unusually large account-key set.
 */
const MAX_INSTRUCTIONS_PER_TX = 6;

export interface BatchPlan {
  /** Instructions for this transaction, in order. */
  instructions: TransactionInstruction[];
  /** Account-actions covered by this batch (for progress reporting). */
  covers: AccountActions[];
}

/**
 * Greedy pack: emit a new batch every {@link MAX_INSTRUCTIONS_PER_TX}
 * instructions. We keep each AccountActions's instructions together (a
 * Burn+Close pair must land in the same tx, never split).
 */
export function planBatches(actions: AccountActions[]): BatchPlan[] {
  const batches: BatchPlan[] = [];
  let current: BatchPlan = { instructions: [], covers: [] };
  for (const a of actions) {
    if (a.skipped || a.instructions.length === 0) continue;
    if (current.instructions.length + a.instructions.length > MAX_INSTRUCTIONS_PER_TX) {
      if (current.instructions.length > 0) batches.push(current);
      current = { instructions: [], covers: [] };
    }
    current.instructions.push(...a.instructions);
    current.covers.push(a);
  }
  if (current.instructions.length > 0) batches.push(current);
  return batches;
}

/**
 * Compile a batch into a v0 (versioned) transaction with a freshly-fetched
 * blockhash. Caller is responsible for signing with the fee payer and the
 * target-wallet keypair before sending.
 */
export async function compileBatch(
  connection: Connection,
  payerPubkey: PublicKey,
  batch: BatchPlan
): Promise<{ tx: VersionedTransaction; recentBlockhash: string; lastValidBlockHeight: number }> {
  const latest = await connection.getLatestBlockhash('confirmed');
  const message = new TransactionMessage({
    payerKey: payerPubkey,
    recentBlockhash: latest.blockhash,
    instructions: batch.instructions
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  return { tx, recentBlockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight };
}
