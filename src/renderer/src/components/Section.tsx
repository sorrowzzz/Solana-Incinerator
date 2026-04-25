import type { ReactNode } from 'react';

export function Section({
  step,
  title,
  description,
  children
}: {
  step: number;
  title: string;
  description?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="section">
      <header className="section-header">
        <span className="section-step">{step}</span>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </header>
      <div className="section-body">{children}</div>
    </section>
  );
}
