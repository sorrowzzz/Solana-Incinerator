import { Connection, type Commitment, type ConnectionConfig } from '@solana/web3.js';

export const DEFAULT_COMMITMENT: Commitment = 'confirmed';

const cache = new Map<string, Connection>();

export function getConnection(rpcUrl: string, commitment: Commitment = DEFAULT_COMMITMENT): Connection {
  const key = `${rpcUrl}::${commitment}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const config: ConnectionConfig = {
    commitment,
    confirmTransactionInitialTimeout: 60_000,
    disableRetryOnRateLimit: false
  };
  const conn = new Connection(rpcUrl, config);
  cache.set(key, conn);
  return conn;
}

export function clearConnectionCache(): void {
  cache.clear();
}
