import { useEffect, useMemo, useRef } from 'react';
import type { IncinerateEvent } from '@shared/types';
import { Section } from './Section';
import { fmtClock, formatSol, shortPubkey } from '../lib/format';

interface Props {
  events: IncinerateEvent[];
  active: boolean;
}

export function ProgressLog({ events, active }: Props): JSX.Element | null {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  const summary = useMemo(() => {
    let recovered = 0;
    let closed = 0;
    let txOk = 0;
    let txFail = 0;
    let walletsDone = 0;
    let walletsFailed = 0;
    for (const e of events) {
      if (e.type === 'wallet-completed') {
        recovered += e.recoveredLamports;
        closed += e.closedAccounts;
        walletsDone++;
      } else if (e.type === 'wallet-failed') {
        walletsFailed++;
      } else if (e.type === 'tx-confirmed') {
        txOk++;
      } else if (e.type === 'tx-failed') {
        txFail++;
      }
    }
    return { recovered, closed, txOk, txFail, walletsDone, walletsFailed };
  }, [events]);

  if (events.length === 0) return null;

  return (
    <Section step={5} title={active ? 'Run in progress' : 'Run results'}>
      <div className="dryrun-summary" style={{ marginBottom: 16 }}>
        <div className="stat">
          <span className="stat-label">Wallets done</span>
          <span className="stat-value">{summary.walletsDone}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Accounts closed</span>
          <span className="stat-value">{summary.closed}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Tx confirmed / failed</span>
          <span className="stat-value">
            {summary.txOk} / {summary.txFail}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Recovered</span>
          <span className="stat-value stat-pos">{formatSol(summary.recovered)}</span>
        </div>
      </div>

      <div className="log-pane" ref={scrollRef}>
        {events.map((e, i) => (
          <div key={i} className={`log-line log-${e.type}`}>
            <span className="log-time">{fmtClock(e.at)}</span>
            <LogContent e={e} />
          </div>
        ))}
      </div>
    </Section>
  );
}

function LogContent({ e }: { e: IncinerateEvent }): JSX.Element {
  switch (e.type) {
    case 'run-started':
      return <span>Run started · {e.walletCount} wallets queued</span>;
    case 'wallet-started':
      return (
        <span>
          [#{e.walletIndex + 1}] processing <code>{shortPubkey(e.pubkey, 6, 6)}</code>
        </span>
      );
    case 'tx-sent':
      return (
        <span>
          [#{e.walletIndex + 1}] tx sent · {e.instructionsInTx} ix ·{' '}
          <SolscanLink sig={e.signature} />
        </span>
      );
    case 'tx-confirmed':
      return (
        <span>
          [#{e.walletIndex + 1}] tx confirmed · <SolscanLink sig={e.signature} />
        </span>
      );
    case 'tx-failed':
      return (
        <span>
          [#{e.walletIndex + 1}] tx failed: {e.error}
          {e.signature && (
            <>
              {' '}
              · <SolscanLink sig={e.signature} />
            </>
          )}
        </span>
      );
    case 'wallet-completed':
      return (
        <span>
          [#{e.walletIndex + 1}] done · closed {e.closedAccounts} · recovered{' '}
          {formatSol(e.recoveredLamports)}
        </span>
      );
    case 'wallet-failed':
      return (
        <span>
          [#{e.walletIndex + 1}] failed: {e.error}
        </span>
      );
    case 'run-completed':
      return <span>Run complete · total recovered {formatSol(e.totalRecoveredLamports)}</span>;
    case 'run-cancelled':
      return <span>Run cancelled by user</span>;
    case 'log':
      return (
        <span>
          [{e.level}] {e.message}
        </span>
      );
  }
}

function SolscanLink({ sig }: { sig: string }): JSX.Element {
  const url = `https://solscan.io/tx/${sig}`;
  return (
    <a
      href={url}
      onClick={(e) => {
        e.preventDefault();
        window.incineratorApi.shell.openExternal(url);
      }}
    >
      <code>{sig.slice(0, 8)}…</code>
    </a>
  );
}
