import { useEffect, useState } from 'react';
import type { AppSettings } from '@shared/types';
import { Section } from './Section';

interface Props {
  settings: AppSettings;
  patch: (p: Partial<AppSettings>) => void;
}

export function ConfigSection({ settings, patch }: Props): JSX.Element {
  const [destStatus, setDestStatus] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [feeStatus, setFeeStatus] = useState<{ ok: boolean; reason?: string; pubkey?: string } | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!settings.destinationAddress.trim()) {
      setDestStatus(null);
      return;
    }
    window.incineratorApi.validate.pubkey(settings.destinationAddress).then((r) => {
      if (alive) setDestStatus(r);
    });
    return () => {
      alive = false;
    };
  }, [settings.destinationAddress]);

  useEffect(() => {
    let alive = true;
    if (!settings.feePayerSecret.trim()) {
      setFeeStatus(null);
      return;
    }
    window.incineratorApi.validate.secret(settings.feePayerSecret).then((r) => {
      if (alive) setFeeStatus(r);
    });
    return () => {
      alive = false;
    };
  }, [settings.feePayerSecret]);

  return (
    <Section step={1} title="Configuration" description="RPC, destination, and fee payer.">
      <div className="form-grid">
        <label className="field">
          <span className="field-label">RPC URL</span>
          <input
            type="text"
            value={settings.rpcUrl}
            onChange={(e) => patch({ rpcUrl: e.target.value })}
            placeholder="https://api.mainnet-beta.solana.com"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
          <span className="field-hint">
            Default is Solana&apos;s public mainnet. Paste a Helius / Triton / QuickNode endpoint for
            higher throughput and rate limits.
          </span>
        </label>

        <label className="field">
          <span className="field-label">
            Destination address
            {destStatus?.ok && <span className="badge badge-ok">valid</span>}
            {destStatus && !destStatus.ok && <span className="badge badge-err">invalid</span>}
          </span>
          <input
            type="text"
            value={settings.destinationAddress}
            onChange={(e) => patch({ destinationAddress: e.target.value })}
            placeholder="Solana address that receives all recovered SOL"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
          <span className="field-hint">
            All rent reclaimed from CloseAccount goes <em>directly</em> here — no intermediate hop.
            Triple-check this address.
            {destStatus && !destStatus.ok && destStatus.reason && (
              <>
                {' '}
                <span className="hint-error">Error: {destStatus.reason}</span>
              </>
            )}
          </span>
        </label>

        <label className="field">
          <span className="field-label">
            Fee payer secret
            <button
              type="button"
              className="link-button"
              onClick={() => setShowSecret((v) => !v)}
            >
              {showSecret ? 'hide' : 'show'}
            </button>
            {feeStatus?.ok && <span className="badge badge-ok">valid</span>}
            {feeStatus && !feeStatus.ok && <span className="badge badge-err">invalid</span>}
          </span>
          <input
            type={showSecret ? 'text' : 'password'}
            value={settings.feePayerSecret}
            onChange={(e) => patch({ feePayerSecret: e.target.value })}
            placeholder="base58 secret OR solana-keygen JSON byte array"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
          <span className="field-hint">
            One small wallet pays fees for the entire run. Funded with ~0.05 SOL is plenty for ~100
            wallets. <strong>Never</strong> use a wallet holding significant funds.
            {feeStatus && !feeStatus.ok && feeStatus.reason && (
              <>
                {' '}
                <span className="hint-error">Error: {feeStatus.reason}</span>
                {' '}
                <span className="hint-tip">
                  (Phantom: Settings → Privacy &amp; security → Show private key — paste the long
                  base58 string; not the recovery phrase.)
                </span>
              </>
            )}
            {feeStatus?.ok && feeStatus.pubkey && (
              <>
                {' '}
                Pubkey: <code>{feeStatus.pubkey}</code>
              </>
            )}
          </span>
        </label>
      </div>
    </Section>
  );
}
