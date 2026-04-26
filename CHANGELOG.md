# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.1] — 2026-04-25

### Fixed: rate-limit storm on dry-runs over many wallets

A user reported the terminal flooding with `Server responded with 429
Too Many Requests. Retrying after 500ms delay...` when dry-running 100+
wallets, even with the RpcGate active.

Root cause: `@solana/web3.js` does its **own** retry-on-429 loop *inside*
each `connection.*` method, **before** returning to the caller. My gate
only delays the first call — the 4 internal retries 500ms apart all
went out ungated, multiplying load by 5x and producing the storm. The
work eventually succeeded, but slowly and noisily.

Fix:
- `disableRetryOnRateLimit: true` on the Connection — web3.js's internal
  retry is disabled. Our outer retry paths (`fetchWithRetry` in dry-run,
  `sendAndConfirmWithRetry` in the runner) re-invoke the patched method,
  so each retry **does** go through the gate.
- Default `rpcRequestsPerSecond` lowered 8 → 5. Helius free tier is
  10 credits/sec and the bulk `getParsedTokenAccountsByOwner` we hit
  most is heavy; 5 RPS leaves room for the occasional simulate /
  getBalance burst without hitting the credit ceiling.
- Outer retry attempts bumped 3 → 5 with **exponential** back-off
  (800ms, 1.6s, 3.2s, 6.4s, 12.8s) so a Helius credit-refill window has
  time to recover.
- "too many" added to the transient-error pattern so we recognise
  Helius's text-mode rate-limit messages alongside the numeric `429`.

## [1.0.0] — 2026-04-25

### First stable release

End-to-end validated against real mainnet wallets. Closes token accounts,
sweeps native SOL, and routes everything to a user-chosen destination
without the source-wallet getting stuck below rent-exempt minimum.

### Added

- **RPC rate limiter** (`AppSettings.rpcRequestsPerSecond`, default 8) —
  module-level interval-gate that serialises outbound JSON-RPC calls so
  we never blow past Helius free-tier's 10-RPS cap. All hot connection
  methods (`getParsedTokenAccountsByOwner`, `getBalance`,
  `getLatestBlockhash`, `sendTransaction`, `confirmTransaction`,
  `simulateTransaction`, `getSignatureStatuses`) are patched at
  Connection-construction time so call sites stay clean.
- **Native SOL sweep** is now full-balance (no fee buffer subtracted).
  The fee payer pays the tx fee from a separate wallet, so the source
  drains to exactly 0 lamports — the only state Solana lets a system
  account fall below rent-exempt without erroring.
- **Honest dry-run preview**: per-wallet estimate now fetches the wallet's
  native SOL balance and includes it in `recoveredLamports` alongside
  rent reclaimed from closes; per-wallet note surfaces the contribution.
- **Real Solana brand mark** (PNG) in the app header, replacing the
  placeholder gradient square.
- **bs58 ESM/CJS interop** fix in the parser (Phantom keys were rejected
  as invalid in Electron's main process due to the v6 ESM-only package
  not interop'ing through `require()`). Downgraded bs58 to 5.x and
  added defensive default-export handling.
- **Better error reporting**: validation badges in the GUI now show the
  actual rejection reason (was: just `INVALID`); the dry-run engine
  classifies RPC errors and points at the right fix (Helius, etc).

### Fixed

- Sweep tx no longer fails with `Transaction results in an account (1)
  with insufficient funds for rent`.
- Validation no longer silently mis-classifies all parser errors as
  "invalid base58" — the underlying error message is preserved.

## [0.1.1-preview.0] — 2026-04-25

### Production-readiness improvements

Validated `npm install`, `npm run typecheck`, `npm test`, and `npm run build`
all pass clean from a cold checkout. Cross-referenced the engine against
`tymur999/sol-incinerator-oss` and the Solana cookbook close-account
recipe; applied the deltas below.

### Added

- **Mint blacklist** — `AppSettings.mintBlacklist` (default: USDC and USDT
  mainnet mints). Blacklisted mints are never burned or closed, even if
  options would otherwise allow it. Editable in the GUI under
  Options → Advanced.
- **ComputeBudget per transaction** — every batch now prepends
  `setComputeUnitLimit` (≈4k CU per instruction + 5k overhead) and
  `setComputeUnitPrice` when the priority-fee setting is non-zero, so the
  scheduler treats each tx with a deterministic CU envelope.
- **Per-tx retry loop** with classification: blockhash-expired, rate-limit
  (429/503), timeout, and "fetch failed" errors retry up to 3 times with
  linear back-off; non-transient errors fail fast. `sendTransaction`'s own
  internal `maxRetries` raised from 3 to 5.
- **Sweep tx accounted for in dry-run fee estimate** — previously the
  preview undershot the fee total by one tx per wallet.

### Changed

- **Batch size**: empirical packing rules informed by the OSS reference:
  up to 12 close-only instructions per tx (down from 14 used by single-sig
  reference tooling, to leave headroom for the second signature in our
  fee-payer architecture); up to 10 instructions when any Burn is in the
  batch (≈5 burn+close pairs). Burn+Close pairs are atomic — never split.
- **Priority-fee preview** is now CU-aware (`μλ × CU / 1e6`) rather than
  the previous flat-rate approximation, so the GUI matches what the
  scheduler will actually charge.

## [0.1.0-preview.0] — 2026-04-25

### Initial preview

First public preview build. The full incinerate engine and GUI are landed
end-to-end and the app builds for macOS, Windows, and Linux. **This is a
preview release intended for testing on throwaway wallets only.**

#### Added

- Cross-platform Electron + Vite + React + TypeScript shell with strict CSP,
  contextIsolation, no nodeIntegration, sandboxed preload, and an
  external-link interceptor.
- Wallet-file parser accepting both Phantom-style base58 and `solana-keygen`
  JSON byte-array formats. Comment and blank-line handling. Per-line error
  reporting.
- Token-account enumeration covering classic SPL Token and Token-2022.
- Per-account action planner: burn-then-close for fungibles with balance,
  close-only for empty and wSOL accounts, frozen accounts skipped.
- Versioned (v0) transaction batcher; conservative six-instructions-per-tx
  ceiling; optional ComputeBudget priority-fee instruction.
- Dry-run engine that previews closeable count, recovered SOL, fees, and
  net per wallet without broadcasting anything.
- Live runner with bounded parallel worker pool, cancellation, structured
  event stream (run-started, wallet-started, tx-sent, tx-confirmed,
  tx-failed, wallet-completed, wallet-failed, run-completed, run-cancelled,
  log) and a final native-SOL sweep step per wallet.
- Single-fee-payer architecture: all CloseAccount destinations are set to
  the user's destination address so SOL flows directly there.
- Settings persistence (RPC, destination, options) — fee-payer secret is
  in-memory only and never written to disk.
- GUI with five-section workflow, live validation badges, per-wallet status
  list, dry-run summary table, final-confirmation modal, and a streaming
  progress log with clickable Solscan links.
- MIT License with explicit attribution clause for redistribution.
- CONTRIBUTING.md with safety guidelines and PR checklist.
- SECURITY.md with threat model and responsible-disclosure policy.

### Known limitations

- No address-lookup-table support yet; very dense wallets (50+ accounts)
  may take more transactions than strictly necessary.
- No per-wallet automatic retry on transient RPC failures (failed batches
  are logged and the run continues; user can re-run for what's left).
- macOS builds are not yet code-signed.
- No CI typecheck on pull requests yet.

### Notes for testers

- Run on a throwaway wallet first.
- Always dry-run before broadcasting.
- Use a low-balance fee payer (~0.05 SOL).
- Public mainnet RPC works for small runs; use Helius / Triton for >10
  wallets to avoid rate limits.
