<div align="center">

# Solana Incinerator

**A cross-platform desktop application for bulk-incinerating Solana wallets — burn dust tokens, close empty token accounts, and reclaim locked SOL rent across many wallets at once.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](./LICENSE)
[![Status](https://img.shields.io/badge/status-stable-brightgreen.svg?style=flat-square)](#)
[![Release](https://img.shields.io/github/v/release/sorrowzzz/Solana-Incinerator?style=flat-square)](https://github.com/sorrowzzz/Solana-Incinerator/releases)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg?style=flat-square)](#)
[![Electron](https://img.shields.io/badge/Electron-2B2E3A?style=flat-square&logo=electron&logoColor=9FEAF9)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-9945FF?style=flat-square&logo=solana&logoColor=white)](https://solana.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](./CONTRIBUTING.md)

</div>

---

## Overview

**Solana Incinerator** is a free, open-source desktop tool that lets you process **multiple Solana wallets in bulk** to:

- Burn unwanted SPL tokens (including NFTs)
- Close empty / dust token accounts to reclaim their rent (~0.002 SOL each)
- Sweep the recovered SOL to a destination address you choose

It runs **entirely on your machine**. Private keys never leave your computer. There is no server, no telemetry, no analytics.

> **Important:** This software handles private keys and broadcasts on-chain transactions. Read the [Security](#security) section in full before using it. The author accepts no liability for lost funds — see [LICENSE](./LICENSE).

## Features

- **Bulk wallet processing** — paste or load a `.txt` file of private keys (one per line) and process them all in a single run.
- **Cross-platform** — macOS (primary), Windows, Linux.
- **Custom RPC support** — defaults to Solana's public mainnet RPC; paste any custom endpoint (Helius, Triton, QuickNode, etc.).
- **User-controlled destination** — every operator picks their own destination wallet for recovered SOL.
- **Dry-run mode** — simulate every transaction and preview expected SOL recovery before broadcasting anything.
- **Single fee-payer architecture** — one funded wallet pays fees for the whole run; recovered rent flows directly to the destination.
- **Transaction batching** — packs multiple `Burn` / `CloseAccount` instructions per transaction within Solana's 1232-byte limit.
- **Local-only** — no servers, no telemetry, no analytics, no key uploads. Ever.

## How it works

Solana stores SPL token balances in dedicated **token accounts** owned by your wallet. Each token account has ~0.002 SOL locked in it as rent. When you no longer want a token, you can:

1. **Burn** any remaining balance via the SPL Token program's `Burn` instruction (sets the supply to zero from your account).
2. **Close** the empty account via the `CloseAccount` instruction, which returns the rent SOL to a destination of your choice.

For wallets full of dust, dropped airdrops, or NFTs you don't want, this can recover meaningful SOL. This app automates that process across many wallets at once.

The Solana built-in programs involved are documented at [docs.solana.com](https://solana.com/docs/core/programs/builtin-programs):

- **System Program** — for SOL transfers
- **SPL Token Program** — for `Burn` and `CloseAccount`
- **SPL Token-2022 Program** — same instructions, the Token-2022 fork is supported transparently

### Architecture diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       Solana Incinerator                        │
│                       (Electron, local)                         │
│                                                                 │
│   ┌──────────────────┐        ┌────────────────────────────┐    │
│   │   GUI (renderer) │ <--IPC│  Engine (main process)      │    │
│   │   React + TS     │        │  • parses wallets.txt      │    │
│   └──────────────────┘        │  • enumerates token acct   │    │
│                                │  • builds Burn + Close ix  │    │
│                                │  • signs v0 versioned txs  │    │
│                                │  • streams progress events │    │
│                                └──────────┬─────────────────┘    │
└────────────────────────────────────────────┼────────────────────┘
                                              │ JSON-RPC
                                              ▼
                                  ┌────────────────────────────┐
                                  │  Solana RPC endpoint       │
                                  │  (mainnet-beta or custom)  │
                                  └────────────────────────────┘
```

Per-wallet pipeline:

```
fetch token accounts ──► build per-account actions ──► pack into v0 txs
                                                              │
                                       sign [feePayer, target]│
                                                              ▼
                                                  send + confirm ──► repeat
                                                              │
                                          all closes done? ◄──┘
                                                  │
                                                  ▼
                                  sweep remaining native SOL
                                  to destination (paid by feePayer)
```

Recovered SOL flows directly into the destination address with each `CloseAccount` instruction — there is no intermediate hop through any other wallet.

## Installation

The recommended way to run the app is **from source** — it's three commands and gives you the exact same binary the release builds. Pre-built `.dmg` artefacts are attached to the [latest release](https://github.com/sorrowzzz/Solana-Incinerator/releases) when network conditions allow upload (the Apple Silicon build is usually present; the Intel x64 build sometimes isn't due to GitHub upload-endpoint issues from the publishing machine — build it yourself with `npm run build:mac` if you need it).

### Prerequisites

- **Node.js 20 or newer.** Check with `node -v`. If you don't have it: install via [nvm](https://github.com/nvm-sh/nvm) (`nvm install 20`) or download from [nodejs.org](https://nodejs.org).
- **git.** Already on macOS (run `xcode-select --install` if missing).

### Run from source (macOS / Linux / Windows)

Open a terminal:

```bash
# 1. Clone the repo to anywhere convenient
git clone https://github.com/sorrowzzz/Solana-Incinerator.git
cd Solana-Incinerator

# 2. Install dependencies (~30s, downloads ~600 npm packages)
npm install

# 3. Launch the app
npm run dev
```

A window titled **Solana Incinerator** opens. Leave the terminal running — `Ctrl+C` in the terminal kills the app. To re-launch later, just `cd Solana-Incinerator && npm run dev` again — you don't need to re-clone or re-install.

### Build a packaged app for distribution

```bash
npm run build:mac     # macOS .dmg in release/<version>/
npm run build:win     # Windows .exe (NSIS installer)
npm run build:linux   # Linux .AppImage and .deb
```

The `.dmg` is unsigned. macOS Gatekeeper blocks it on first open — right-click the app inside the `.dmg` → *Open* → click *Open* in the dialog. macOS remembers the choice for that copy.

### Updating to a new version

```bash
cd Solana-Incinerator
git pull
npm install   # only needed if package-lock.json changed
npm run dev
```

### Troubleshooting

| Symptom | Fix |
|---|---|
| `npm install` errors out | Make sure `node -v` reports 20.x or higher. Delete `node_modules/` and `package-lock.json`, then re-run. |
| App window opens to a blank screen | Quit the app (`Ctrl+C`), then re-run `npm run dev`. The renderer dev server sometimes needs a clean start. |
| `fetch failed` on dry-run | The public Solana RPC is rate-limited. Get a free Helius URL (see [Usage](#usage) below) and paste it into the RPC field. |
| Pasting a Phantom key shows `INVALID` with a real reason | The error text below the field tells you what's wrong (recovery phrase vs private key, wrong byte length, etc.). |
| `Transaction results in an account with insufficient funds for rent` during sweep | Update to v1.0.0 or later — that bug is fixed in the stable release. |

## Usage

This is a step-by-step walkthrough. Read it in full before your first real run.

### Prerequisites — set these up once, before pasting any keys

1. **A Helius RPC URL** (free tier is fine). The public Solana mainnet RPC heavily rate-limits the bulk-token-account calls this app makes — you will get `fetch failed` errors on it.
   - Sign up at <https://helius.dev>
   - Copy your dedicated mainnet URL — looks like `https://mainnet.helius-rpc.com/?api-key=<your-key>`
   - Treat that URL like a password. Don't commit it, paste it into chats, or share it.

2. **A "fee-payer" wallet.** This is a *small* wallet whose only job is to pay transaction fees for the entire run. Create a fresh Phantom wallet (or `solana-keygen new`), fund it with **~0.05 SOL** (enough for ~100 target wallets), and export its private key.
   - **Never** use a wallet that holds significant funds as the fee payer.

3. **A "destination" address.** The Solana address that will receive every SOL the app recovers. Use a fresh wallet you control — *not* the fee payer, *not* your main holdings. Once you trust the run, you can sweep funds to your main wallet manually.

4. **A `wallets.txt` file.** One private key per line, for each wallet you want to incinerate. Both formats accepted:
   - Phantom export (base58, ~88 chars)
   - `solana-keygen` JSON byte array `[12, 34, ..., 255]`

   Lines starting with `#` are comments; blank lines are ignored. See [`wallets.example.txt`](./wallets.example.txt) for the format. Save the file *outside* the repo directory — it contains every key, treat it like a vault.

### Running the app

```bash
git clone https://github.com/sorrowzzz/Solana-Incinerator.git
cd Solana-Incinerator
npm install
npm run dev
```

A window titled *Solana Incinerator* opens. Walk through the five sections in order:

#### Section 1 — Configuration
- **RPC URL** → paste the Helius URL from prerequisite 1.
- **Destination address** → paste from prerequisite 3. Wait for the green `VALID` badge.
- **Fee payer secret** → paste from prerequisite 2. Wait for the green `VALID` badge; the derived pubkey is shown beneath the field — verify it matches the wallet you funded.

#### Section 2 — Target wallets
Click **Browse for wallets.txt** or paste the file contents directly into the textarea. The list parses live — fix any per-line errors before continuing.

#### Section 3 — Options
Defaults are sensible. Change only if you know what you want.
- **Burn non-zero balances** — required for closing accounts that still hold dust.
- **Close empty accounts** — reclaim ~0.002 SOL of rent per account.
- **Close NFT accounts** — treat NFTs as ordinary SPL tokens.
- **Concurrent wallets** — 4. Drop to 2 on a slow RPC.
- **Priority fee** — 0. Bump to 1000–10000 during mainnet congestion.
- **RPC requests / second** — 8. Safe for Helius free tier (10 RPS limit). Raise on paid tiers.
- **Advanced → mint blacklist** — pre-loaded with USDC and USDT mainnet mints. Add any other mints you want to protect.

#### Section 4 — Dry Run
Click **Dry Run**. *Nothing is broadcast.* The app fetches every wallet's token accounts and the wallet's native SOL balance, then reports:
- *Closeable accounts* — total count
- *Estimated recovered* — total SOL you'll receive (rent + native sweep)
- *Estimated fees* — paid by the fee-payer wallet
- *Net recovery* — what actually lands at the destination

Expand **Per-wallet breakdown** to see each wallet's numbers, including a `includes native SOL sweep of N SOL` note when applicable. If any wallet shows an error, **stop and investigate** before broadcasting.

#### Section 5 — Incinerate
After a clean dry-run that matches what you expect:
1. Click **Incinerate**.
2. Verify *every line* in the confirmation modal — wallets, accounts, net recovery, destination, fee payer, RPC.
3. Click **Yes, incinerate**.

The progress log streams every event live with clickable Solscan links. Use **Cancel run** to stop mid-flight (already-confirmed txs are not reversible — that's just Solana, not the app).

### After the run
- Verify the destination wallet's balance on Solscan matches the *Recovered* total (minus a few lamports of rounding).
- Each target wallet should now be at exactly 0 SOL — confirming the sweep worked.
- **Delete `wallets.txt` from disk** if you're done. The app keeps nothing in memory after exit; the file is the only artefact that needs cleanup.

## Security

This app holds private keys in memory while it runs. **Read this before pasting any real keys:**

- **Never share your `wallets.txt`** with anyone. Treat it like a vault.
- **Use a dedicated destination wallet** — not your main holdings wallet — to receive recovered SOL until you trust the run.
- **Always dry-run first.** Verify the destination address character-by-character.
- **Use a low-balance fee payer.** It only needs ~0.05 SOL for typical runs; do not fund it from cold storage.
- This app is **open source** specifically so you can read every line that touches your keys before running it. You are encouraged to do so.
- See [SECURITY.md](./SECURITY.md) for the full threat model and the responsible-disclosure policy.

## Roadmap

- [x] Foundation: license, docs, contribution policy
- [x] Electron + TypeScript scaffold
- [x] Wallet-file parsing (base58 + JSON byte-array)
- [x] Token-account enumeration via RPC (classic SPL + Token-2022)
- [x] Burn + close instruction builder with batching
- [x] Dry-run preview engine
- [x] GUI: settings, file loader, progress dashboard
- [x] First preview release: `v0.1.0-preview`
- [x] Production-readiness pass (`v0.1.1-preview`): real-network validated, batching tuned, retries, blacklist
- [x] Stable: `v1.0.0` — RPC rate limiter, full-balance native-SOL sweep, real Solana brand mark
- [ ] CI typecheck/test workflow
- [ ] Code-signed & notarised macOS builds
- [ ] Address Lookup Table support to push more closes per tx
- [ ] Per-wallet retry / resume on partial failure

## Contributing

Contributions are very welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR — it covers branch hygiene, the **no-secret-leaks** policy, the test requirements, and the commit-signoff convention.

## License

This project is licensed under the **MIT License** with an explicit attribution clause for redistribution. See [LICENSE](./LICENSE).

If you fork, host, or republish this software, **you must give visible credit to [sorrowz](https://github.com/sorrowzzz)** and retain the license notice.

---

<div align="center">

Made by <a href="https://github.com/sorrowzzz">sorrowz</a>. Not affiliated with Solana Labs, Phantom, or sol-incinerator.com.

</div>
