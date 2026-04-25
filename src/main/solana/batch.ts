import {
  ComputeBudgetProgram,
  TransactionMessage,
  VersionedTransaction,
  type PublicKey,
  type TransactionInstruction,
  type Connection
} from '@solana/web3.js';
import type { AccountActions } from './instructions';

/**
 * Hard ceiling on close-only-tokens-per-tx. Reference open-source incinerators
 * settled empirically on 14 close instructions per tx for >90% confirmation,
 * but those use a single-signer model. Our single-fee-payer architecture
 * adds a second signature (64 bytes) so we drop to 12 to leave headroom.
 */
const MAX_IX_CLOSE_ONLY = 12;
/**
 * Lower ceiling when any Burn instruction is in the batch — burns carry an
 * extra mint key so the byte budget is tighter. 10 ix ≈ 5 burn+close pairs.
 */
const MAX_IX_WITH_BURNS = 10;
/**
 * Compute units to budget per instruction. Conservative: a CloseAccount or
 * Burn typically uses ~3k CU; we round up to absorb small variation across
 * Token vs Token-2022.
 */
export const CU_PER_INSTRUCTION = 4_000;

export interface BatchPlan {
  /** Instructions for this transaction, in order. */
  instructions: TransactionInstruction[];
  /** Account-actions covered by this batch (for progress reporting). */
  covers: AccountActions[];
  /** True if any instruction in the batch is a Burn. */
  hasBurn: boolean;
}

/**
 * Greedy pack: emit a new batch when adding the next AccountActions would
 * cross the size budget. Burn+Close pairs are kept atomic — never split
 * across two transactions, because a Close on a non-empty account fails.
 */
export function planBatches(actions: AccountActions[]): BatchPlan[] {
  const batches: BatchPlan[] = [];
  let current: BatchPlan = { instructions: [], covers: [], hasBurn: false };

  for (const a of actions) {
    if (a.skipped || a.instructions.length === 0) continue;

    const isPair = a.instructions.length >= 2;
    const willHaveBurn = current.hasBurn || isPair;
    const limit = willHaveBurn ? MAX_IX_WITH_BURNS : MAX_IX_CLOSE_ONLY;

    if (current.instructions.length + a.instructions.length > limit) {
      if (current.instructions.length > 0) batches.push(current);
      current = { instructions: [], covers: [], hasBurn: false };
    }

    current.instructions.push(...a.instructions);
    current.covers.push(a);
    if (isPair) current.hasBurn = true;
  }
  if (current.instructions.length > 0) batches.push(current);
  return batches;
}

/**
 * Compile a batch into a v0 (versioned) transaction with a freshly-fetched
 * blockhash, optionally prepending ComputeBudget instructions for
 * deterministic CU limit and priority fee.
 */
export async function compileBatch(
  connection: Connection,
  payerPubkey: PublicKey,
  batch: BatchPlan,
  options: { priorityFeeMicroLamports?: number; computeUnitsHint?: number } = {}
): Promise<{ tx: VersionedTransaction; recentBlockhash: string; lastValidBlockHeight: number }> {
  return compileInstructions(connection, payerPubkey, batch.instructions, options);
}

export async function compileInstructions(
  connection: Connection,
  payerPubkey: PublicKey,
  instructions: TransactionInstruction[],
  options: { priorityFeeMicroLamports?: number; computeUnitsHint?: number } = {}
): Promise<{ tx: VersionedTransaction; recentBlockhash: string; lastValidBlockHeight: number }> {
  const finalIxs: TransactionInstruction[] = [];

  if (options.computeUnitsHint && options.computeUnitsHint > 0) {
    finalIxs.push(
      ComputeBudgetProgram.setComputeUnitLimit({ units: Math.ceil(options.computeUnitsHint) })
    );
  }
  if (options.priorityFeeMicroLamports && options.priorityFeeMicroLamports > 0) {
    finalIxs.push(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: options.priorityFeeMicroLamports
      })
    );
  }
  finalIxs.push(...instructions);

  const latest = await connection.getLatestBlockhash('confirmed');
  const message = new TransactionMessage({
    payerKey: payerPubkey,
    recentBlockhash: latest.blockhash,
    instructions: finalIxs
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  return { tx, recentBlockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight };
}
