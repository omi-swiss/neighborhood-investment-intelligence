"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AlertRule = {
  id: number;
  entityType: string;
  entityKey: string;
  eventTypes: string[];
  enabled: boolean;
};
type WatchItem = {
  id: number;
  entityType: "area" | "property";
  entityKey: string;
  label: string;
  snapshot: Record<string, unknown>;
  updatedAt: string;
  rule: AlertRule | null;
};
type Watchlist = {
  id: number;
  name: string;
  description: string | null;
  items: WatchItem[];
};
type Alert = {
  id: number;
  entityType: string;
  entityKey: string;
  eventType: string;
  title: string;
  previous: Record<string, unknown> | null;
  current: Record<string, unknown>;
  sourceName: string;
  sourceUrl: string | null;
  whyItMatters: string;
  detectedAt: string;
  readAt: string | null;
};
type SavedSearch = {
  id: number;
  name: string;
  searchType: string;
  query: Record<string, unknown>;
  snapshot: { propertyIds?: number[]; checkedAt?: string };
  updatedAt: string;
};

const eventLabels: Record<string, string> = {
  new_property_listing: "New property",
  price_reduction: "Price reduction",
  property_status_change: "Status change",
  neighborhood_score_change: "Score change",
  rent_trend_change: "Rent change",
  vacancy_change: "Vacancy change",
  regulation_change: "Regulation change",
  data_refresh: "Data refresh",
};

function entityHref(type: string, key: string) {
  return type === "area" ? `/areas/${key}` : type === "property" ? `/properties/${key}` : "#";
}

function queryHref(query: Record<string, unknown>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) params.set(key, String(value));
  });
  return `/properties?${params}`;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "Not available";
  if (typeof value === "number") return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value);
  return String(value);
}

async function fetchMonitoringState(eventFilter: string, unreadOnly: boolean) {
  const query = new URLSearchParams();
  if (eventFilter) query.set("eventType", eventFilter);
  if (unreadOnly) query.set("unread", "1");
  const [listResponse, alertResponse, searchResponse] = await Promise.all([
    fetch("/api/watchlists"),
    fetch(`/api/alerts?${query}`),
    fetch("/api/saved-searches"),
  ]);
  if ([listResponse, alertResponse, searchResponse].some((response) => response.status === 401)) {
    throw new Error("Sign in through the private site to use monitoring.");
  }
  if ([listResponse, alertResponse, searchResponse].some((response) => !response.ok)) {
    throw new Error("Monitoring data could not be loaded.");
  }
  return {
    lists: ((await listResponse.json()) as { items: Watchlist[] }).items,
    alerts: await alertResponse.json() as { items: Alert[]; unreadCount: number },
    searches: ((await searchResponse.json()) as { items: SavedSearch[] }).items,
  };
}

export function WatchlistWorkspace() {
  const [lists, setLists] = useState<Watchlist[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [status, setStatus] = useState("Loading monitoring workspace...");
  const [name, setName] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [working, setWorking] = useState(false);

  async function load() {
    try {
      const result = await fetchMonitoringState(eventFilter, unreadOnly);
      setLists(result.lists);
      setAlerts(result.alerts.items);
      setUnreadCount(result.alerts.unreadCount);
      setSearches(result.searches);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Monitoring data could not be loaded.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    void fetchMonitoringState(eventFilter, unreadOnly)
      .then((result) => {
        if (cancelled) return;
        setLists(result.lists);
        setAlerts(result.alerts.items);
        setUnreadCount(result.alerts.unreadCount);
        setSearches(result.searches);
        setStatus("");
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : "Monitoring data could not be loaded.");
        }
      });
    return () => { cancelled = true; };
  }, [eventFilter, unreadOnly]);

  const watchedCount = useMemo(
    () => lists.reduce((total, list) => total + list.items.length, 0),
    [lists],
  );

  async function createList() {
    if (!name.trim()) return;
    setWorking(true);
    const response = await fetch("/api/watchlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    setWorking(false);
    setStatus(response.ok ? "Watchlist created." : "Watchlist could not be created.");
    await load();
  }

  async function refreshMonitoring() {
    setWorking(true);
    setStatus("Comparing current evidence with saved snapshots...");
    const response = await fetch("/api/monitoring/refresh", { method: "POST" });
    if (response.ok) {
      const result = (await response.json()) as { checked: number; created: number };
      setStatus(
        `Checked ${result.checked} monitored targets and created ${result.created} new alert${result.created === 1 ? "" : "s"}.`,
      );
    } else {
      setStatus("Monitoring refresh could not be completed.");
    }
    setWorking(false);
    await load();
  }

  async function removeItem(id: number) {
    await fetch(`/api/watchlists?itemId=${id}`, { method: "DELETE" });
    await load();
  }

  async function removeList(id: number) {
    await fetch(`/api/watchlists?id=${id}`, { method: "DELETE" });
    await load();
  }

  async function removeSearch(id: number) {
    await fetch(`/api/saved-searches?id=${id}`, { method: "DELETE" });
    await load();
  }

  async function toggleEvent(item: WatchItem, eventType: string) {
    if (!item.rule || eventType === "regulation_change") return;
    const eventTypes = item.rule.eventTypes.includes(eventType)
      ? item.rule.eventTypes.filter((value) => value !== eventType)
      : [...item.rule.eventTypes, eventType];
    await fetch("/api/alert-rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType: item.entityType,
        entityKey: item.entityKey,
        eventTypes,
        enabled: item.rule.enabled,
      }),
    });
    await load();
  }

  async function markRead(id?: number) {
    await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : { all: true }),
    });
    await load();
  }

  return (
    <>
      <div className="scope-strip">
        <strong>In-app monitoring</strong>
        <span>{watchedCount} watched targets</span>
        <span>{searches.length} saved searches</span>
        <span>{unreadCount} unread alerts</span>
      </div>
      <div className="monitor-actions">
        <div className="field inline-field">
          <label htmlFor="watchlist-name">New watchlist</label>
          <input
            id="watchlist-name"
            value={name}
            placeholder="e.g. Northeast DC candidates"
            onChange={(event) => setName(event.target.value)}
          />
          <button className="button" disabled={working || !name.trim()} onClick={() => void createList()}>
            Create
          </button>
        </div>
        <button className="button primary" disabled={working} onClick={() => void refreshMonitoring()}>
          {working ? "Checking..." : "Check for updates"}
        </button>
      </div>
      {status ? <p className="status-message" role="status">{status}</p> : null}
      <div className="content-grid monitoring-grid">
        <section className="detail-card">
          <h2>Watchlists</h2>
          {!lists.length ? <p className="drawer-lead">Create a watchlist, then add an area or property from its profile.</p> : null}
          {lists.map((list) => (
            <div className="watchlist-block" key={list.id}>
              <div className="watchlist-heading">
                <div><strong>{list.name}</strong>{list.description ? <span>{list.description}</span> : null}</div>
                <button className="text-button" onClick={() => void removeList(list.id)}>Delete</button>
              </div>
              {!list.items.length ? <p className="metric-sub">No targets yet.</p> : null}
              {list.items.map((item) => (
                <article className="watch-item" key={item.id}>
                  <div className="watch-item-head">
                    <div>
                      <span className="quality">{item.entityType}</span>
                      <Link href={entityHref(item.entityType, item.entityKey)}><strong>{item.label}</strong></Link>
                    </div>
                    <button className="text-button" onClick={() => void removeItem(item.id)}>Remove</button>
                  </div>
                  <div className="rule-options">
                    {Object.entries(eventLabels)
                      .filter(([eventType]) =>
                        item.entityType === "area"
                          ? ["neighborhood_score_change", "rent_trend_change", "vacancy_change", "regulation_change", "data_refresh"].includes(eventType)
                          : ["price_reduction", "property_status_change", "data_refresh"].includes(eventType),
                      )
                      .map(([eventType, label]) => (
                        <label className={eventType === "regulation_change" ? "unavailable-rule" : ""} key={eventType}>
                          <input
                            type="checkbox"
                            checked={item.rule?.eventTypes.includes(eventType) ?? false}
                            disabled={eventType === "regulation_change"}
                            onChange={() => void toggleEvent(item, eventType)}
                          />
                          {label}{eventType === "regulation_change" ? " — source unavailable" : ""}
                        </label>
                      ))}
                  </div>
                  <small>Last snapshot {new Date(item.updatedAt).toLocaleString()}</small>
                </article>
              ))}
            </div>
          ))}
          <div className="method-note">
            Regulation-change monitoring: source unavailable until a validated primary policy feed is integrated.
          </div>
        </section>
        <section className="detail-card">
          <h2>Saved property searches</h2>
          {!searches.length ? <p className="drawer-lead">Save criteria from Analyze Property to monitor new matching imports.</p> : null}
          {searches.map((search) => (
            <div className="saved-row" key={search.id}>
              <div>
                <Link href={queryHref(search.query)}><strong>{search.name}</strong></Link>
                <span>
                  {search.snapshot.propertyIds?.length ?? 0} current matches
                  {search.snapshot.checkedAt ? ` | Checked ${new Date(search.snapshot.checkedAt).toLocaleString()}` : ""}
                </span>
              </div>
              <button className="text-button" onClick={() => void removeSearch(search.id)}>Remove</button>
            </div>
          ))}
          <div className="method-note">
            Monitoring compares imported property records and published area snapshots on demand. It does not scrape listing sites or send email/SMS.
          </div>
        </section>
        <section className="detail-card wide-card">
          <div className="alert-toolbar">
            <div><h2>Alert inbox</h2><span>{unreadCount} unread</span></div>
            <div className="actions">
              <select aria-label="Alert event filter" value={eventFilter} onChange={(event) => setEventFilter(event.target.value)}>
                <option value="">All changes</option>
                {Object.entries(eventLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
              <label><input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} /> Unread only</label>
              <button className="button" disabled={!unreadCount} onClick={() => void markRead()}>Mark all read</button>
            </div>
          </div>
          {!alerts.length ? <p className="drawer-lead">No alerts match this view. Run “Check for updates” after new data is imported or released.</p> : null}
          <div className="alert-list">
            {alerts.map((alert) => (
              <article className={`alert-card ${alert.readAt ? "" : "unread"}`} key={alert.id}>
                <div className="alert-head">
                  <div>
                    <span className="quality">{eventLabels[alert.eventType] ?? alert.eventType}</span>
                    <Link href={entityHref(alert.entityType, alert.entityKey)}><h3>{alert.title}</h3></Link>
                    <small>{new Date(alert.detectedAt).toLocaleString()} | {alert.sourceName}</small>
                  </div>
                  {!alert.readAt ? <button className="text-button" onClick={() => void markRead(alert.id)}>Mark read</button> : null}
                </div>
                <div className="change-grid">
                  <ChangeFacts title="Previous" facts={alert.previous} />
                  <ChangeFacts title="New" facts={alert.current} />
                </div>
                <p><strong>Why it matters:</strong> {alert.whyItMatters}</p>
                {alert.sourceUrl ? <a className="source-link" href={alert.sourceUrl} rel="noreferrer" target="_blank">Open source</a> : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function ChangeFacts({
  title,
  facts,
}: {
  title: string;
  facts: Record<string, unknown> | null;
}) {
  return (
    <div className="change-facts">
      <strong>{title}</strong>
      {!facts ? <span>Not previously observed</span> : Object.entries(facts).map(([key, value]) => (
        <span key={key}>{key.replaceAll(/([A-Z])/g, " $1")}: {formatValue(value)}</span>
      ))}
    </div>
  );
}
