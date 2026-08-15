import Link from "next/link";

const primary = [
  ["DM", "Discover Markets", "/"],
  ["AP", "Analyze Property", "/properties"],
  ["CP", "Compare", "/compare"],
  ["SO", "Saved Opportunities", "/saved"],
  ["ME", "Methodology", "/methodology"],
];

const secondary = [
  ["UW", "Underwriting", "/underwriting"],
  ["SG", "Signals", "/signals"],
  ["WL", "Watchlists", "/watchlists"],
  ["SR", "Sources", "/sources"],
  ["DH", "Data health", "/health"],
  ["ST", "Advanced Strategy", "/settings/strategies"],
];

export function AppNavigation({ active = "Discover Markets" }: { active?: string }) {
  return (
    <aside className="side-nav" aria-label="Primary navigation">
      <Link className="brand" href="/" aria-label="Neighborhood Investment Intelligence home">
        <span className="brand-mark">NII</span>
        <span className="brand-copy">
          <strong>Neighborhood</strong>
          <span>Investment Intelligence</span>
        </span>
      </Link>
      <p className="nav-label">Investor workflow</p>
      {primary.map(([icon, label, href]) => (
        <Link
          aria-current={active === label ? "page" : undefined}
          className={`nav-item ${active === label ? "active" : ""}`}
          href={href}
          key={label}
        >
          <span className="nav-icon" aria-hidden="true">{icon}</span>
          <span>{label}</span>
        </Link>
      ))}
      <p className="nav-label">Systems</p>
      {secondary.map(([icon, label, href]) => (
        <Link
          aria-current={active === label ? "page" : undefined}
          className={`nav-item ${active === label ? "active" : ""}`}
          href={href}
          key={label}
        >
          <span className="nav-icon" aria-hidden="true">{icon}</span>
          <span>{label}</span>
        </Link>
      ))}
      <div className="nav-spacer" />
    </aside>
  );
}
