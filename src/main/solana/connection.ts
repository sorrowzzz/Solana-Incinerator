import { Connection, type Commitment, type ConnectionConfig } from '@solana/web3.js';
import { getGate } from './rpc-gate';

export const DEFAULT_COMMITMENT: Commitment = 'confirmed';

const cache = new Map<string, Connection>();

/**
 * Returns a singleton Connection for the given RPC URL with all hot
 * methods rate-limited via the shared interval-gate. The first call
 * for an `(rpcUrl, rps)` pair constructs and patches the Connection;
 * subsequent calls return the cached instance.
 */
export function getConnection(
  rpcUrl: string,
  rps = 8,
  commitment: Commitment = DEFAULT_COMMITMENT
): Connection {
  const key = `${rpcUrl}::${commitment}::${rps}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const config: ConnectionConfig = {
    commitment,
    confirmTransactionInitialTimeout: 60_000,
    disableRetryOnRateLimit: false
  };
  const conn = new Connection(rpcUrl, config);
  applyRateLimit(conn, rpcUrl, rps);
  cache.set(key, conn);
  return conn;
}

/**
 * Hot RPC methods we wrap with the gate. Anything network-touching the
 * incinerate engine actually calls should be in this list.
 */
const RATE_LIMITED_METHODS = [
  'getParsedTokenAccountsByOwner',
  'getBalance',
  'getLatestBlockhash',
  'sendTransaction',
  'sendRawTransaction',
  'confirmTransaction',
  'simulateTransaction',
  'getSignatureStatuses'
] as const;

function applyRateLimit(conn: Connection, rpcUrl: string, rps: number): void {
  if (rps <= 0) return;
  const gate = getGate(rpcUrl, rps);
  for (const m of RATE_LIMITED_METHODS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const target = conn as unknown as Record<string, any>;
    const orig = target[m];
    if (typeof orig !== 'function') continue;
    const bound = orig.bind(conn);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    target[m] = async (...args: any[]) => {
      await gate.wait();
      return bound(...args);
    };
  }
}

export function clearConnectionCache(): void {
  cache.clear();
}
