import type { ReactNode } from "react";
import dataset from "../data/areas.generated.json";
import { AppNavigation } from "./AppNavigation";
import { DataVintageNotice, type DataVintageItem } from "./DataVintageNotice";

export function PageShell({
  active,
  title,
  eyebrow,
  description,
  actions,
  dataVintages,
  children,
}: {
  active: string;
  title: string;
  eyebrow: string;
  description: string;
  actions?: ReactNode;
  dataVintages?: DataVintageItem[];
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <AppNavigation active={active} />
      <main className="main" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <strong>Neighborhood Investment Intelligence</strong>
          <div className="topbar-meta">
            <span>Core ACS {dataset.coverage.scoreReferenceYear}</span>
            <span className="health">Core data healthy</span>
            <span className="user-chip" aria-label="Private workspace">OH</span>
          </div>
        </header>
        <div className="page">
          <div className="page-head">
            <div>
              <p className="eyebrow">{eyebrow}</p>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            {actions ? <div className="actions">{actions}</div> : null}
          </div>
          <DataVintageNotice items={dataVintages} />
          {children}
        </div>
      </main>
    </div>
  );
}
