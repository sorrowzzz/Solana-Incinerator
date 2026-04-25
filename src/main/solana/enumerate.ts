import { PublicKey, type Connection } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, NATIVE_MINT } from '@solana/spl-token';

export interface OwnedTokenAccount {
  /** Token account address. */
  pubkey: PublicKey;
  /** Mint of the token in this account. */
  mint: PublicKey;
  /** Owner of the token account (the wallet pubkey). */
  owner: PublicKey;
  /** Raw token amount as a u64 string. */
  amount: bigint;
  /** Account data lamports — what gets returned on CloseAccount, plus any wSOL. */
  lamports: number;
  /** Token decimals as reported by the parsed account. */
  decimals: number;
  /** Account state: initialized | frozen. Frozen accounts cannot be closed. */
  state: 'initialized' | 'frozen' | 'uninitialized';
  /** Which program owns the account: classic SPL Token or Token-2022. */
  programId: PublicKey;
  /** True iff this is the native-SOL (wSOL) mint. */
  isNative: boolean;
}

interface ParsedTokenAccountInfo {
  parsed?: {
    info: {
      mint: string;
      owner: string;
      state: string;
      tokenAmount: { amount: string; decimals: number };
      isNative?: boolean;
    };
  };
}

/**
 * Fetch every SPL Token (classic + Token-2022) account owned by `owner`.
 * Uses RPC's `getParsedTokenAccountsByOwner` so we don't have to decode
 * raw account layouts ourselves.
 */
export async function fetchOwnedTokenAccounts(
  connection: Connection,
  owner: PublicKey
): Promise<OwnedTokenAccount[]> {
  const [classic, token2022] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID })
  ]);

  const out: OwnedTokenAccount[] = [];
  for (const { value, programId } of [
    { value: classic.value, programId: TOKEN_PROGRAM_ID },
    { value: token2022.value, programId: TOKEN_2022_PROGRAM_ID }
  ]) {
    for (const entry of value) {
      const data = (entry.account.data as ParsedTokenAccountInfo).parsed;
      if (!data) continue;
      const info = data.info;
      const mint = new PublicKey(info.mint);
      const acctOwner = new PublicKey(info.owner);
      const stateRaw = (info.state || 'initialized').toLowerCase();
      const state: OwnedTokenAccount['state'] =
        stateRaw === 'frozen'
          ? 'frozen'
          : stateRaw === 'uninitialized'
            ? 'uninitialized'
            : 'initialized';
      out.push({
        pubkey: entry.pubkey,
        mint,
        owner: acctOwner,
        amount: BigInt(info.tokenAmount.amount),
        lamports: entry.account.lamports,
        decimals: info.tokenAmount.decimals,
        state,
        programId,
        isNative: mint.equals(NATIVE_MINT)
      });
    }
  }
  return out;
}
