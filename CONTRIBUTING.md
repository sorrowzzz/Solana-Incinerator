# Contributing

Thanks for your interest in contributing to **Solana Incinerator**. This project handles private keys and on-chain funds, so contributions are held to a high bar for safety, clarity, and review.

## Ground rules

1. **Never commit secrets.** Real private keys, real wallet addresses belonging to anyone, real RPC API keys, `.env` files, credentials, or anything similar. Examples must use clearly-fake placeholder values.
2. **Never add telemetry, analytics, crash reporting, or any "phone-home" functionality.** This is a hard constraint of the project's threat model.
3. **No closed-source binary blobs.** Every dependency must be auditable.
4. **Small, focused PRs.** One logical change per PR. Easier to review, easier to roll back.
5. **Tests for new behaviour.** Especially anything that touches transaction construction, key parsing, or rent accounting.

## Getting started

```bash
git clone https://github.com/sorrowzzz/Solana-Incinerator.git
cd Solana-Incinerator
npm install
npm run dev
```

## Branching

- `main` — always releasable. Protected.
- `dev/<topic>` — feature work.
- `fix/<topic>` — bug fixes.
- `docs/<topic>` — documentation only.

## Commit messages

Use conventional-style prefixes for clarity:

```
feat: add lookup-table support for batched closes
fix: handle wallets with zero token accounts
docs: expand SECURITY.md threat model
refactor: split tx builder out of run loop
chore: bump @solana/web3.js
test: add fixture for malformed base58 keys
```

Keep the subject line under 72 characters. Body wrapped at 100. Reference issues with `#NNN`.

## Pull request checklist

Before opening a PR:

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] No secrets, real keys, or real addresses in the diff (audit the patch yourself)
- [ ] No new telemetry / network calls beyond the user-configured RPC
- [ ] Updated `README.md` / `SECURITY.md` if behaviour changed
- [ ] Added or updated tests for new logic

## Code review

Every PR requires at least one approving review from a maintainer. Reviews focus on:

- **Safety** — does this change risk user funds?
- **Clarity** — can a stranger reading the diff understand what it does?
- **Scope** — does the PR do exactly what it claims, and nothing more?

## Reporting vulnerabilities

See [SECURITY.md](./SECURITY.md). **Do not** open a public issue for security problems.

## Code of Conduct

Be kind, be technical, be specific. No personal attacks, no harassment, no spam, no shilling tokens. Maintainers reserve the right to close discussions or ban participants who don't meet that bar.

## License

By contributing, you agree that your contributions will be licensed under the project's [MIT License with attribution clause](./LICENSE).
