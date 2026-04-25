import { useEffect, useState } from 'react';

export function App(): JSX.Element {
  const [version, setVersion] = useState<string>('…');

  useEffect(() => {
    window.incineratorApi.getAppVersion().then(setVersion).catch(() => setVersion('?'));
  }, []);

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
        <span className="version-tag">v{version}</span>
      </header>

      <main className="app-main">
        <section className="placeholder-card">
          <h2>Preview build</h2>
          <p>
            The incinerate engine and wallet loader are under active development. The
            project scaffold is in place; this screen will be replaced by the full GUI in
            an upcoming commit.
          </p>
          <p className="muted">
            Source code: <code>github.com/sorrowzzz/Solana-Incinerator</code>
          </p>
        </section>
      </main>

      <footer className="app-footer">
        <span>Open-source · MIT · Local-only · No telemetry</span>
      </footer>
    </div>
  );
}
