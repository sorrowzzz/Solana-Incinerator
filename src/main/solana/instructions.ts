import { type PublicKey, type TransactionInstruction } from '@solana/web3.js';
import { createBurnInstruction, createCloseAccountInstruction } from '@solana/spl-token';
import type { OwnedTokenAccount } from './enumerate';

export interface AccountActions {
  account: OwnedTokenAccount;
  /** Instructions to execute, in order. May be 1 (close-only) or 2 (burn+close). */
  instructions: TransactionInstruction[];
  /** True if we skipped this account entirely (frozen or unsupported). */
  skipped: boolean;
  skipReason?: string;
}

export interface BuildOptions {
  /** Wallet that owns the token accounts and authorises burns/closes. */
  ownerPubkey: PublicKey;
  /** Where rent (and unwrapped wSOL) should land. */
  destinationPubkey: PublicKey;
  burnNonZeroBalances: boolean;
  closeEmptyAccounts: boolean;
  /** Treat NFTs (decimals=0, supply~1) the same as fungible tokens. */
  closeNftAccounts: boolean;
  /** Mint addresses (base58) to skip entirely. */
  mintBlacklist?: Set<string>;
}

/**
 * Build the on-chain action list for one target wallet.
 *
 *  - wSOL (native mint) accounts can be closed directly; closing unwraps
 *    the SOL into the destination.
 *  - Other SPL accounts with a non-zero balance must be burned first; we
 *    add a Burn before the CloseAccount.
 *  - Frozen accounts are skipped — closing them requires the freeze
 *    authority to thaw first.
 */
export function buildActionsForWallet(
  accounts: OwnedTokenAccount[],
  opts: BuildOptions
): AccountActions[] {
  const out: AccountActions[] = [];
  for (const acct of accounts) {
    if (opts.mintBlacklist && opts.mintBlacklist.has(acct.mint.toBase58())) {
      out.push({ account: acct, instructions: [], skipped: true, skipReason: 'mint blacklisted' });
      continue;
    }
    if (acct.state === 'frozen') {
      out.push({ account: acct, instructions: [], skipped: true, skipReason: 'frozen' });
      continue;
    }
    if (acct.state === 'uninitialized') {
      out.push({ account: acct, instructions: [], skipped: true, skipReason: 'uninitialized' });
      continue;
    }

    const isNft = acct.decimals === 0;
    if (isNft && !opts.closeNftAccounts) {
      out.push({ account: acct, instructions: [], skipped: true, skipReason: 'nft skipped by setting' });
      continue;
    }

    const ix: TransactionInstruction[] = [];
    const isEmpty = acct.amount === 0n;

    if (!isEmpty && acct.isNative) {
      // wSOL: closing unwraps balance + rent into destination. No burn needed.
    } else if (!isEmpty) {
      if (!opts.burnNonZeroBalances) {
        out.push({
          account: acct,
          instructions: [],
          skipped: true,
          skipReason: 'non-zero balance, burn disabled'
        });
        continue;
      }
      ix.push(
        createBurnInstruction(
          acct.pubkey,
          acct.mint,
          opts.ownerPubkey,
          acct.amount,
          [],
          acct.programId
        )
      );
    } else if (isEmpty && !opts.closeEmptyAccounts) {
      out.push({
        account: acct,
        instructions: [],
        skipped: true,
        skipReason: 'empty, close disabled'
      });
      continue;
    }

    ix.push(
      createCloseAccountInstruction(
        acct.pubkey,
        opts.destinationPubkey,
        opts.ownerPubkey,
        [],
        acct.programId
      )
    );

    out.push({ account: acct, instructions: ix, skipped: false });
  }
  return out;
}
