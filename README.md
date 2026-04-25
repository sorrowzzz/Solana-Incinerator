<div align="center">

# Solana Incinerator

**A cross-platform desktop application for bulk-incinerating Solana wallets — burn dust tokens, close empty token accounts, and reclaim locked SOL rent across many wallets at once.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](./LICENSE)
[![Status](https://img.shields.io/badge/status-preview-orange.svg?style=flat-square)](#)
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

### From source (current method during preview)

> Pre-built binaries will be published under [Releases](https://github.com/sorrowzzz/Solana-Incinerator/releases) once the app reaches a stable preview milestone.

```bash
git clone https://github.com/sorrowzzz/Solana-Incinerator.git
cd Solana-Incinerator
npm install
npm run dev
```

Build a packaged app for your OS:

```bash
npm run build:mac     # macOS .dmg
npm run build:win     # Windows .exe
npm run build:linux   # Linux .AppImage / .deb
```

## Usage

1. **Launch** the app.
2. **Configure RPC** — leave the default (`https://api.mainnet-beta.solana.com`) or paste your Helius / Triton / custom endpoint.
3. **Set destination** — paste the Solana address that should receive all recovered SOL.
4. **Set fee payer** — paste the private key of a wallet funded with a small amount of SOL (~0.05 SOL is plenty for ~100 wallets) that will pay transaction fees for the whole run.
5. **Load target wallets** — drag-and-drop or browse to a `.txt` file containing one private key per line (Phantom-style base58 or `solana-keygen` JSON byte arrays — both are accepted). See [`wallets.example.txt`](./wallets.example.txt).
6. **Dry-run first** — preview what the run will do, how many accounts will be closed, and how much SOL is expected to be recovered. Nothing is broadcast.
7. **Incinerate** — confirm in the modal, then watch progress per-wallet. Transaction signatures are linked to Solscan as they confirm.

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
- [ ] CI / typecheck workflow
- [ ] Code-signed macOS builds
- [ ] Address Lookup Table support to push more closes per tx
- [ ] Per-wallet retry / resume on partial failure
- [ ] Stable: `v1.0.0`

## Contributing

Contributions are very welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR — it covers branch hygiene, the **no-secret-leaks** policy, the test requirements, and the commit-signoff convention.

## License

This project is licensed under the **MIT License** with an explicit attribution clause for redistribution. See [LICENSE](./LICENSE).

If you fork, host, or republish this software, **you must give visible credit to [sorrowz](https://github.com/sorrowzzz)** and retain the license notice.

---

<div align="center">

Made by <a href="https://github.com/sorrowzzz">sorrowz</a>. Not affiliated with Solana Labs, Phantom, or sol-incinerator.com.

</div>
