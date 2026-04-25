# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
