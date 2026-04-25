import { useEffect, useMemo, useState } from 'react';
import type { ParsedWallet } from '@shared/types';
import { Section } from './Section';
import { shortPubkey } from '../lib/format';

interface Props {
  text: string;
  setText: (next: string) => void;
}

export function WalletsSection({ text, setText }: Props): JSX.Element {
  const [parsed, setParsed] = useState<ParsedWallet[]>([]);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!text.trim()) {
      setParsed([]);
      return;
    }
    const handle = setTimeout(() => {
      window.incineratorApi.wallets.parseText(text).then((res) => {
        if (alive) setParsed(res as ParsedWallet[]);
      });
    }, 150);
    return () => {
      alive = false;
      clearTimeout(handle);
    };
  }, [text]);

  const okCount = useMemo(() => parsed.filter((p) => p.ok).length, [parsed]);
  const errCount = parsed.length - okCount;

  async function browse(): Promise<void> {
    const r = await window.incineratorApi.wallets.openDialog();
    if (!r.canceled) setText(r.text);
  }

  return (
    <Section
      step={2}
      title="Target wallets"
      description="One private key per line. Phantom-style base58 OR solana-keygen JSON byte-array. Lines starting with # are comments."
    >
      <div className="row" style={{ marginBottom: 12 }}>
        <button type="button" className="btn btn-secondary" onClick={browse}>
          Browse for wallets.txt
        </button>
        {parsed.length > 0 && (
          <>
            <span className="counter counter-ok">{okCount} valid</span>
            {errCount > 0 && <span className="counter counter-err">{errCount} error{errCount === 1 ? '' : 's'}</span>}
            <button type="button" className="link-button" onClick={() => setShowList((v) => !v)}>
              {showList ? 'hide list' : 'show list'}
            </button>
          </>
        )}
      </div>

      <textarea
        className="wallets-input"
        rows={8}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        placeholder={
          '# One secret per line. Examples:\n' +
          '# 5Kf8...long_base58_secret_here...XyZ   # main wallet\n' +
          '# [12,34,56, ... 64 numbers ... ,255]    # solana-keygen format\n'
        }
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      {showList && parsed.length > 0 && (
        <div className="wallets-list">
          {parsed.map((p) => (
            <div key={p.line} className={`wallet-row ${p.ok ? '' : 'wallet-row-err'}`}>
              <span className="wallet-line">L{p.line}</span>
              {p.ok ? (
                <>
                  <code>{shortPubkey(p.pubkey, 6, 6)}</code>
                  <span className="wallet-format">{p.format}</span>
                </>
              ) : (
                <span className="wallet-error">{p.error}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
