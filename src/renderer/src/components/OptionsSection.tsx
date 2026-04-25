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
      </div>
    </Section>
  );
}
