/**
 * Interval-gate rate limiter for outbound JSON-RPC calls.
 *
 * Calls `wait()` returns when the next slot is available. Slots are spaced
 * `intervalMs` apart, so the steady-state throughput is 1 / intervalMs RPS.
 *
 * Single-FIFO semantics: if N callers race for the gate, they serialise
 * in arrival order; the first returns immediately (or after a small wait
 * if the gate is hot), and subsequent callers wait `intervalMs * (i-1)`.
 */
class RpcGate {
  private nextSlot = 0;
  constructor(private intervalMs: number) {}

  setIntervalMs(intervalMs: number): void {
    this.intervalMs = intervalMs;
  }

  async wait(): Promise<void> {
    if (this.intervalMs <= 0) return;
    const now = Date.now();
    const slot = Math.max(this.nextSlot, now);
    this.nextSlot = slot + this.intervalMs;
    const delay = slot - now;
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
  }
}

const gates = new Map<string, RpcGate>();

export function getGate(rpcUrl: string, requestsPerSecond: number): RpcGate {
  const intervalMs = requestsPerSecond > 0 ? Math.ceil(1000 / requestsPerSecond) : 0;
  const existing = gates.get(rpcUrl);
  if (existing) {
    existing.setIntervalMs(intervalMs);
    return existing;
  }
  const gate = new RpcGate(intervalMs);
  gates.set(rpcUrl, gate);
  return gate;
}

/**
 * Convenience: wrap an RPC-call thunk so it waits its turn at the gate
 * before running. Always use this for any `connection.*` method call so
 * the global throttle is respected.
 */
export async function gated<T>(rpcUrl: string, requestsPerSecond: number, fn: () => Promise<T>): Promise<T> {
  await getGate(rpcUrl, requestsPerSecond).wait();
  return fn();
}
