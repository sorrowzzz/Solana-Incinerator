export const LAMPORTS_PER_SOL = 1_000_000_000;

export function lamportsToSol(lamports: number | bigint): number {
  const n = typeof lamports === 'bigint' ? Number(lamports) : lamports;
  return n / LAMPORTS_PER_SOL;
}

export function formatSol(lamports: number | bigint, decimals = 6): string {
  return `${lamportsToSol(lamports).toFixed(decimals)} SOL`;
}

export function formatLamports(lamports: number | bigint): string {
  const n = typeof lamports === 'bigint' ? lamports : BigInt(Math.trunc(lamports));
  return `${n.toLocaleString('en-US')} lamports`;
}
