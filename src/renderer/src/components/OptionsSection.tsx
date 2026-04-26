import type { AppSettings } from '@shared/types';
import { Section } from './Section';

interface Props {
  settings: AppSettings;
  patch: (p: Partial<AppSettings>) => void;
}

export function OptionsSection({ settings, patch }: Props): JSX.Element {
  return (
    <Section step={3} title="Options" description="Default values are sensible — change only if you know what you want.">
      <div className="checkbox-row">
        <label>
          <input
            type="checkbox"
            checked={settings.burnNonZeroBalances}
            onChange={(e) => patch({ burnNonZeroBalances: e.target.checked })}
          />
          <span>Burn tokens with non-zero balance before closing</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.closeEmptyAccounts}
            onChange={(e) => patch({ closeEmptyAccounts: e.target.checked })}
          />
          <span>Close empty token accounts (reclaim rent)</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.closeNftAccounts}
            onChange={(e) => patch({ closeNftAccounts: e.target.checked })}
          />
          <span>Close NFT accounts</span>
        </label>
      </div>
      <div className="form-grid form-grid-2">
        <label className="field">
          <span className="field-label">Concurrent wallets</span>
          <input
            type="number"
            min={1}
            max={8}
            value={settings.maxConcurrentWallets}
            onChange={(e) => patch({ maxConcurrentWallets: Math.max(1, Math.min(8, Number(e.target.value) || 1)) })}
          />
          <span className="field-hint">Higher = faster, but more RPC pressure. 4 is a good default.</span>
        </label>
        <label className="field">
          <span className="field-label">Priority fee (μλ / CU)</span>
          <input
            type="number"
            min={0}
            value={settings.priorityFeeMicroLamports}
            onChange={(e) => patch({ priorityFeeMicroLamports: Math.max(0, Number(e.target.value) || 0) })}
          />
          <span className="field-hint">0 disables. Try 1000–10000 during congestion.</span>
        </label>
        <label className="field">
          <span className="field-label">RPC requests / sec</span>
          <input
            type="number"
            min={0}
            max={100}
            value={settings.rpcRequestsPerSecond}
            onChange={(e) =>
              patch({ rpcRequestsPerSecond: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })
            }
          />
          <span className="field-hint">
            Hard cap on outbound RPC calls per second. 5 is safe for Helius free tier (10 credits/sec
            cap, and the bulk token-account call we use is heavy). Lower this to 2–3 if you still
            see 429 errors. Raise to 20+ on paid tiers; set 0 to disable.
          </span>
        </label>
      </div>

      <details className="advanced">
        <summary>Advanced — mint blacklist</summary>
        <label className="field" style={{ marginTop: 10 }}>
          <span className="field-label">Mints to never touch (one per line)</span>
          <textarea
            className="wallets-input"
            rows={4}
            spellCheck={false}
            value={(settings.mintBlacklist ?? []).join('\n')}
            onChange={(e) =>
              patch({
                mintBlacklist: e.target.value
                  .split(/\r?\n/)
                  .map((s) => s.trim())
                  .filter((s) => s.length > 0)
              })
            }
          />
          <span className="field-hint">
            Defaults include USDC and USDT mainnet mints so they are never burned/closed by accident.
            Add any other mints you want to protect.
          </span>
        </label>
      </details>
    </Section>
  );
}
