# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
