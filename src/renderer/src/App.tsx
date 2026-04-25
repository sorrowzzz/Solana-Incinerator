import { useEffect, useMemo, useState } from 'react';
import { useSettings } from './hooks/useSettings';
import { useIncinerate } from './hooks/useIncinerate';
import { ConfigSection } from './components/ConfigSection';
import { WalletsSection } from './components/WalletsSection';
import { OptionsSection } from './components/OptionsSection';
import { RunPanel } from './components/RunPanel';
import { ProgressLog } from './components/ProgressLog';

export function App(): JSX.Element {
  const [version, setVersion] = useState<string>('…');
  const { settings, patch } = useSettings();
  const [walletsText, setWalletsText] = useState('');
  const ic = useIncinerate();

  useEffect(() => {
    window.incineratorApi.getAppVersion().then(setVersion).catch(() => setVersion('?'));
  }, []);

  const walletLines = useMemo(
    () => walletsText.split(/\r?\n/).filter((l) => {
      const t = l.trim();
      return t.length > 0 && !t.startsWith('#');
    }),
    [walletsText]
  );

  const ready =
    walletLines.length > 0 &&
    settings.rpcUrl.trim().length > 0 &&
    settings.destinationAddress.trim().length > 0 &&
    settings.feePayerSecret.trim().length > 0;

  const startDryRun = (): void => {
    void ic.startDryRun(walletLines, settings);
  };
  const startLiveRun = (): void => {
    void ic.startLiveRun(walletLines, settings);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true" />
          <div className="brand-text">
            <h1>Solana Incinerator</h1>
            <p>Bulk burn dust, close empty token accounts, reclaim locked SOL.</p>
          </div>
        </div>
        <div className="header-meta">
          <a
            className="header-link"
            href="https://github.com/sorrowzzz/Solana-Incinerator"
            onClick={(e) => {
              e.preventDefault();
              window.incineratorApi.shell.openExternal('https://github.com/sorrowzzz/Solana-Incinerator');
            }}
          >
            github.com/sorrowzzz/Solana-Incinerator
          </a>
          <span className="version-tag">v{version}</span>
        </div>
      </header>

      <main className="app-main">
        <ConfigSection settings={settings} patch={patch} />
        <WalletsSection text={walletsText} setText={setWalletsText} />
        <OptionsSection settings={settings} patch={patch} />
        <RunPanel
          busy={ic.busy}
          active={ic.run.active}
          ready={ready}
          walletCount={walletLines.length}
          dryRun={ic.dryRun}
          error={ic.error}
          onDryRun={startDryRun}
          onIncinerate={startLiveRun}
          onCancel={ic.cancelRun}
          onClear={ic.clear}
        />
        <ProgressLog events={ic.run.events} active={ic.run.active} />
      </main>

      <footer className="app-footer">
        <span>Open-source · MIT · Local-only · No telemetry</span>
        <span className="muted">Author: sorrowz · Built with Electron + Solana web3.js</span>
      </footer>
    </div>
  );
}
