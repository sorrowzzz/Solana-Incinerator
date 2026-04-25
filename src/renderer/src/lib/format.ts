const LAMPORTS_PER_SOL = 1_000_000_000;

export function lamportsToSol(lamports: number | bigint): number {
  const n = typeof lamports === 'bigint' ? Number(lamports) : lamports;
  return n / LAMPORTS_PER_SOL;
}

export function formatSol(lamports: number | bigint, decimals = 6): string {
  return `${lamportsToSol(lamports).toFixed(decimals)} SOL`;
}

export function shortPubkey(pubkey: string, head = 4, tail = 4): string {
  if (pubkey.length <= head + tail + 1) return pubkey;
  return `${pubkey.slice(0, head)}…${pubkey.slice(-tail)}`;
}

export function fmtClock(ts: number): string {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
