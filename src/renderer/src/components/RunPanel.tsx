import { useState } from 'react';
import type { DryRunReport } from '@shared/types';
import { Section } from './Section';
import { formatSol, shortPubkey } from '../lib/format';

interface Props {
  busy: boolean;
  active: boolean;
  ready: boolean;
  walletCount: number;
  dryRun: DryRunReport | null;
  error: string | null;
  onDryRun: () => void;
  onIncinerate: () => void;
  onCancel: () => void;
  onClear: () => void;
}

export function RunPanel(props: Props): JSX.Element {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <Section step={4} title="Run" description="Always dry-run first. Verify destination character-by-character.">
      <div className="row run-actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={props.busy || props.active || !props.ready}
          onClick={props.onDryRun}
        >
          Dry Run
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={props.busy || props.active || !props.ready || !props.dryRun}
          onClick={() => setShowConfirm(true)}
        >
          Incinerate
        </button>
        {props.active && (
          <button type="button" className="btn btn-ghost" onClick={props.onCancel}>
            Cancel run
          </button>
        )}
        <button type="button" className="link-button" onClick={props.onClear}>
          Clear results
        </button>
      </div>

      {props.error && <div className="alert alert-error">{props.error}</div>}

      {props.dryRun && (
        <div className="dryrun">
          <div className="dryrun-summary">
            <div className="stat">
              <span className="stat-label">Closeable accounts</span>
              <span className="stat-value">{props.dryRun.totalCloseableAccounts.toLocaleString()}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Estimated recovered</span>
              <span className="stat-value stat-pos">
                {formatSol(props.dryRun.totalEstimatedRecoveredLamports)}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Estimated fees</span>
              <span className="stat-value stat-neg">
                −{formatSol(props.dryRun.totalEstimatedFeesLamports)}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Net recovery</span>
              <span className="stat-value stat-net">{formatSol(props.dryRun.totalEstimatedNetLamports)}</span>
            </div>
          </div>
          <details className="dryrun-detail">
            <summary>Per-wallet breakdown</summary>
            <table>
              <thead>
                <tr>
                  <th>Wallet</th>
                  <th>Token accts</th>
                  <th>Closeable</th>
                  <th>Recovered</th>
                  <th>Fees</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {props.dryRun.walletReports.map((w) => (
                  <tr key={w.pubkey} className={w.ok ? '' : 'row-error'}>
                    <td>
                      <code>{shortPubkey(w.pubkey, 6, 6)}</code>
                      {w.error && <div className="muted">{w.error}</div>}
                    </td>
                    <td>{w.tokenAccountCount}</td>
                    <td>{w.closeableAccountCount}</td>
                    <td>{formatSol(w.estimatedRecoveredLamports)}</td>
                    <td>{formatSol(w.estimatedFeesLamports)}</td>
                    <td>{formatSol(w.estimatedNetLamports)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      )}

      {showConfirm && props.dryRun && (
        <div className="modal-backdrop" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Final confirmation</h3>
            <p>You are about to broadcast real transactions. Verify everything below.</p>
            <ul className="modal-stats">
              <li>
                <strong>Wallets:</strong> {props.walletCount}
              </li>
              <li>
                <strong>Accounts to close:</strong>{' '}
                {props.dryRun.totalCloseableAccounts.toLocaleString()}
              </li>
              <li>
                <strong>Estimated net recovery:</strong>{' '}
                {formatSol(props.dryRun.totalEstimatedNetLamports)}
              </li>
              <li>
                <strong>Destination:</strong> <code>{props.dryRun.destinationAddress}</code>
              </li>
              <li>
                <strong>Fee payer:</strong> <code>{props.dryRun.feePayerPubkey}</code>
              </li>
              <li>
                <strong>RPC:</strong> <code>{props.dryRun.rpcUrl}</code>
              </li>
            </ul>
            <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowConfirm(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  setShowConfirm(false);
                  props.onIncinerate();
                }}
              >
                Yes, incinerate
              </button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}
