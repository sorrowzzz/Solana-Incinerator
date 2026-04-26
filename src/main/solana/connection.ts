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
  rps = 3,
  commitment: Commitment = DEFAULT_COMMITMENT
): Connection {
  const key = `${rpcUrl}::${commitment}::${rps}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const config: ConnectionConfig = {
    commitment,
    confirmTransactionInitialTimeout: 60_000,
    // Critical: web3.js's internal retry-on-429 bypasses our RpcGate. If we
    // leave it on, a single 429 spawns 5 ungated retries 500ms apart,
    // multiplying load by 5x and producing the rate-limit storm we see in
    // the terminal. Our outer retry paths (fetchWithRetry in dry-run,
    // sendAndConfirmWithRetry in the runner) re-invoke the patched method,
    // so each retry goes through the gate.
    disableRetryOnRateLimit: true,
    // Point the WebSocket endpoint at an unresolvable host. We do not call
    // any subscription-based API (confirmTransaction is replaced with
    // poll-based confirmByPoll), so the WS should never actually open.
    // If something accidentally tries to subscribe, this fails fast and
    // loud instead of silently degrading throughput.
    wsEndpoint: 'wss://invalid.solana-incinerator.invalid/'
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
  'getSignatureStatuses',
  'getBlockHeight'
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
