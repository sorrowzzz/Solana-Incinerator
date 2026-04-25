# Security Policy

## Threat Model

**Solana Incinerator** is a *self-custodial* desktop tool. It loads private keys into memory, builds transactions locally, and broadcasts them through a Solana RPC endpoint. It never sends private keys anywhere.

### What this app guarantees

- Private keys are loaded into memory only for the duration of a run and are never:
  - Written to disk by the app
  - Logged or printed anywhere
  - Sent over any network connection
- No telemetry, analytics, crash reporting, or "phone-home" of any kind.
- All network traffic is to the user-configured Solana RPC endpoint, and only consists of standard JSON-RPC calls (`getTokenAccountsByOwner`, `sendTransaction`, etc.).
- All source code is public; no closed-source dependencies are loaded at runtime beyond audited npm packages declared in `package.json`.

### What this app does **not** protect against

- A compromised operating system, malware, keyloggers, or screen recorders on your machine.
- Physical access to your machine while keys are in memory.
- A malicious or compromised RPC endpoint that could attempt to censor or front-run your transactions (use a reputable provider).
- A malicious destination address you typed by mistake — **always verify the destination character-by-character.**
- A compromised or modified build of this app obtained from somewhere other than this official repository or the Releases page. Verify checksums.

## Best practices for users

1. **Run dry-run first.** Always.
2. **Use a low-balance fee payer wallet.** Never use a wallet holding significant funds as the fee payer.
3. **Use a fresh destination wallet** until you trust the run; you can move funds to your main holdings afterward.
4. **Do not store `wallets.txt` on disk longer than you need to.** Delete it after the run. Consider running from an encrypted volume.
5. **Read the source.** This is an MIT-licensed, open-source project specifically so you can audit every line that touches your keys.
6. **Verify release checksums** when downloading pre-built binaries.

## Reporting a Vulnerability

If you discover a security vulnerability in this project:

1. **Do not** open a public GitHub issue.
2. Contact the maintainer privately via GitHub: open a private security advisory at
   <https://github.com/sorrowzzz/Solana-Incinerator/security/advisories/new>.
3. Provide:
   - A clear description of the issue.
   - Steps to reproduce.
   - The version / commit hash you tested against.
   - Your assessment of impact.

You will receive an acknowledgement within 7 days. Coordinated disclosure is appreciated.

## Out of scope

The following are **not** considered vulnerabilities:

- Phishing or social-engineering attacks against end users.
- Issues caused by a compromised host operating system or RPC provider.
- Issues caused by user error (typing a wrong destination address, etc.).
- Theoretical attacks requiring physical access to the user's unlocked machine.
