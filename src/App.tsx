import { useEffect, useState, useCallback, type FormEvent } from "react";
import {
  Activity,
  Bell,
  Database,
  Search,
  ShieldCheck,
  BriefcaseBusiness,
  BookOpen,
  RefreshCw,
  Upload,
  LogOut,
} from "lucide-react";
import type { ScanResult, Snapshot } from "../shared/schema";
import type { Job, Alert } from "../shared/operations";
import type { Identity } from "../shared/schema";
type Security = Identity & { providerSymbol: string };
type Health = {
  mode: string;
  providers: { provider: string; configured: boolean }[];
  historyConfigured: boolean;
  notificationConfigured: boolean;
  lastScan?: { at: string; coverage: string[]; errors: number };
  lastWorkerError?: string;
  universeSize: number;
  intervalMinutes: number;
  scannerEnabled: boolean;
  notice: string;
};
type Evidence = {
  id: string;
  key: string;
  kind: string;
  date: string;
  url: string;
  facts: string;
  interpretation: string;
};
type Holding = {
  symbol: string;
  market: string;
  currency: string;
  shares: number;
  bookCost: number;
};
const base = import.meta.env.VITE_API_BASE_URL ?? "";
const money = (n: number | undefined, currency = "USD") =>
  n === undefined
    ? "—"
    : new Intl.NumberFormat("en", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(n);
const fmt = (n: number | null | undefined) =>
  n == null
    ? "Unavailable"
    : n.toLocaleString("en", { maximumFractionDigits: 2 });
const when = (x: string | undefined) =>
  x ? new Date(x).toLocaleString() : "Not run yet";
const metricLabels: Record<string, string> = {
  annualPe: "Annual P/E (×)",
  annualPeriodEnd: "Fiscal year",
  forwardPe: "Forward P/E (×)",
  peg: "Forward PEG",
  marketCap: "Market capitalization",
  priceBook: "Price / book (×)",
  evEbitda: "EV / EBITDA (×)",
  fcfYield: "Annual FCF yield (%)",
  roic: "ROIC (%)",
  netDebtEbitda: "Net debt / EBITDA (×)",
  interestCoverage: "Interest coverage (×)",
  cashConversion: "Three-year cash conversion (%)",
  aggregateFcf: "Three-year free cash flow",
  dilutionPct: "Annual share dilution (%)",
  cagrYears: "Growth interval (years)",
  revenueCagr: "Revenue CAGR (%)",
  epsCagr: "EPS CAGR (%)",
  fcfPerShareCagr: "FCF per share CAGR (%)",
  marginOfSafety: "Margin of safety (%)",
  bearReturn: "Bear scenario return (%)",
  baseReturn: "Conservative scenario return (%)",
  bullReturn: "Bull scenario return (%)",
};
for (const years of [3, 5, 10])
  for (const field of ["revenue", "eps", "fcfPerShare"])
    metricLabels[`${field}Cagr${years}Y`] =
      `${field === "revenue" ? "Revenue" : field === "eps" ? "EPS" : "FCF per share"} ${years}-year CAGR (%)`;
const metricValue = (key: string, value: number | null, currency: string) =>
  value == null
    ? "Unavailable"
    : ["marketCap", "aggregateFcf"].includes(key)
      ? money(value, currency)
      : key === "annualPeriodEnd"
        ? String(value)
        : fmt(
            [
              "cashConversion",
              "marginOfSafety",
              "bearReturn",
              "baseReturn",
              "bullReturn",
            ].includes(key)
              ? value * 100
              : value,
          );
const safeUrl = (x: string) => (/^https?:\/\//i.test(x) ? x : "#");
export default function App() {
  const [page, setPage] = useState("Overview"),
    [token, setToken] = useState(""),
    [draftToken, setDraftToken] = useState(""),
    [session, setSession] = useState(""),
    [connected, setConnected] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [health, setHealth] = useState<Health | null>(null),
    [results, setResults] = useState<ScanResult[]>([]),
    [jobs, setJobs] = useState<Job[]>([]),
    [alerts, setAlerts] = useState<Alert[]>([]),
    [universe, setUniverse] = useState<Security[]>([]),
    [snapshots, setSnapshots] = useState<Snapshot[]>([]),
    [evidence, setEvidence] = useState<Evidence[]>([]),
    [holdings, setHoldings] = useState<Holding[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [market, setMarket] = useState("ALL");
  const request = useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
      const r = await fetch(base + path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "omit",
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(body.message ?? body.error ?? `HTTP ${r.status}`);
      return body as T;
    },
    [token],
  );
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [h, r, j, a, u, s, e, p] = await Promise.all([
        request<Health>("/api/market/status"),
        request<ScanResult[]>("/api/scans"),
        request<Job[]>("/api/jobs"),
        request<Alert[]>("/api/alerts"),
        request<Security[]>("/api/universe"),
        request<Snapshot[]>("/api/snapshots"),
        request<Evidence[]>("/api/evidence"),
        request<{ holdings: Holding[] }>("/api/portfolio"),
      ]);
      setHealth(h);
      setResults(r);
      setJobs(j);
      setAlerts(a);
      setUniverse(u);
      setSnapshots(s);
      setEvidence(e);
      setHoldings(p.holdings);
      setConnected(true);
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [request]);
  useEffect(() => {
    let cancelled = false;
    fetch(base + "/api/session")
      .then((r) => r.json())
      .then((s) => {
        if (!cancelled) setSession(s.authentication);
      })
      .catch(() =>
        setError("API unavailable. Start the server or configure the API URL."),
      );
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (session === "local-loopback" || token) void refresh();
  }, [session, token, refresh]);
  useEffect(() => {
    if (!connected) return;
    const id = setInterval(() => void refresh(), 30000);
    return () => clearInterval(id);
  }, [connected, refresh]);
  async function queue(key: string) {
    try {
      const j = await request<Job>("/api/research", {
        method: "POST",
        body: JSON.stringify({ key }),
      });
      setMessage(`Research job ${j.status}. Results update automatically.`);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function importDataset(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024)
        throw Error("Maximum dataset size is 2 MB");
      const dataset = JSON.parse(await file.text());
      await request("/api/import", {
        method: "POST",
        body: JSON.stringify(dataset),
      });
      setMessage("Dataset accepted; research queued.");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function saveEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      await request("/api/evidence", {
        method: "POST",
        body: JSON.stringify(data),
      });
      form.reset();
      setMessage("Evidence saved with source and date.");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function importHoldings(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 100000) throw Error("Holdings file too large");
      await request("/api/portfolio", {
        method: "POST",
        body: await file.text(),
      });
      setMessage("Manual holdings saved.");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const visible = results.filter(
    (r) =>
      (market === "ALL" || r.identity.market === market) &&
      `${r.identity.name} ${r.identity.symbol}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const detail = results.find((r) => r.id === selected),
    snap = detail
      ? snapshots.find((s) => `${s.market}:${s.symbol}` === detail.id)
      : undefined;
  return (
    <div className="workspace">
      <aside>
        <a className="brand" href="#" onClick={() => setPage("Overview")}>
          <Activity />
          SignalDesk<span>RESEARCH</span>
        </a>
        <p className="eyebrow">Capital research workspace</p>
        <nav>
          {[
            ["Overview", Activity],
            ["Market radar", Search],
            ["Research queue", Database],
            ["Evidence", BookOpen],
            ["Portfolio", BriefcaseBusiness],
            ["Notifications", Bell],
          ].map(([name, Icon]) => {
            const I = Icon as typeof Activity;
            return (
              <button
                key={String(name)}
                className={page === name ? "active" : ""}
                onClick={() => {
                  setPage(String(name));
                  setSelected(null);
                }}
              >
                <I size={18} />
                {String(name)}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <ShieldCheck />
          <strong>Research only</strong>
          <p>
            Verified evidence before conviction. No orders or brokerage access.
          </p>
        </div>
        <small className="connection">
          {connected ? "API connected" : "API disconnected"} ·{" "}
          {session === "local-loopback"
            ? "Local workspace"
            : "Private workspace"}
        </small>
      </aside>
      <main>
        <header>
          <div className="searchbox">
            <Search size={17} />
            <input
              aria-label="Search candidates"
              placeholder="Search companies or tickers"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage("Market radar");
              }}
            />
          </div>
          <button
            className="secondary"
            disabled={loading || !session}
            onClick={() => void refresh()}
          >
            <RefreshCw size={15} />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          {token && (
            <button
              className="secondary"
              onClick={() => {
                setToken("");
                setConnected(false);
                setResults([]);
                setSnapshots([]);
                setHoldings([]);
                setEvidence([]);
                setAlerts([]);
                setJobs([]);
              }}
            >
              <LogOut size={15} />
              Disconnect
            </button>
          )}
        </header>
        <section className="content">
          <div className="page-title">
            <div>
              <p className="eyebrow">USA / CANADA / INDIA</p>
              <h1>{selected ? "Company research" : page}</h1>
              <p className="subtitle">
                Evidence, valuation and entry conditions in one place.
              </p>
            </div>
            <span className="badge">UNVALIDATED RESEARCH</span>
          </div>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="notice" role="status">
              {message}
              <button onClick={() => setMessage("")} aria-label="Dismiss">
                ×
              </button>
            </div>
          )}
          {session === "oidc" && !connected && (
            <form
              className="panel login"
              onSubmit={(e) => {
                e.preventDefault();
                setToken(draftToken);
                setDraftToken("");
              }}
            >
              <h2>Connect your private workspace</h2>
              <p>
                Use a short-lived access token from your configured identity
                provider. It stays in memory and is cleared on reload.
              </p>
              <input
                type="password"
                autoComplete="off"
                aria-label="Access token"
                value={draftToken}
                onChange={(e) => setDraftToken(e.target.value)}
              />
              <button className="primary">Connect</button>
            </form>
          )}
          {detail ? (
            <Detail
              result={detail}
              snapshot={snap}
              back={() => setSelected(null)}
            />
          ) : (
            <>
              {page === "Overview" && (
                <>
                  <div className="metrics">
                    <Metric
                      label="Configured universe"
                      value={String(health?.universeSize ?? 0)}
                      sub="Rotating coverage; not the whole market"
                    />
                    <Metric
                      label="Qualified research"
                      value={String(
                        results.filter((x) => x.status === "QUALIFIED").length,
                      )}
                      sub="All data and review gates passed"
                    />
                    <Metric
                      label="Needs more evidence"
                      value={String(
                        results.filter((x) => x.status === "RESEARCH").length,
                      )}
                      sub="Missing checks do not count as passes"
                    />
                    <Metric
                      label="Data unavailable"
                      value={String(
                        results.filter((x) => x.status === "UNAVAILABLE")
                          .length,
                      )}
                      sub="Provider or dataset needs attention"
                    />
                  </div>
                  <div className="two-col">
                    <article className="panel">
                      <h2>Data and delivery</h2>
                      {health?.providers.map((p) => (
                        <div className="row" key={p.provider}>
                          <strong>{p.provider}</strong>
                          <span className="badge">
                            {p.configured ? "KEY CONFIGURED" : "NOT CONFIGURED"}
                          </span>
                        </div>
                      ))}
                      <div className="row">
                        <span>Notifications</span>
                        <strong>
                          {health?.notificationConfigured
                            ? "Webhook configured"
                            : "In-app outbox only"}
                        </strong>
                      </div>
                      <p className="muted">
                        {health?.notice ??
                          "Waiting for API. No market data has been loaded."}
                      </p>
                    </article>
                    <article className="panel">
                      <h2>Last scan</h2>
                      <strong>{when(health?.lastScan?.at)}</strong>
                      <p>
                        {health?.lastScan?.coverage.join(" · ") ??
                          "No completed scan yet"}
                      </p>
                      <p className="muted">
                        {health?.lastScan?.errors ?? 0} data errors ·{" "}
                        {health?.intervalMinutes ?? 60} minute scan cadence
                      </p>
                      {health?.lastWorkerError && (
                        <p className="negative">{health.lastWorkerError}</p>
                      )}
                      <h3>Readiness</h3>
                      <p>
                        {health?.scannerEnabled
                          ? "Background worker enabled"
                          : "Background worker disabled"}
                        . Price history, source-linked financials and a current
                        analyst review are required for qualification.
                      </p>
                    </article>
                  </div>
                  <article className="panel">
                    <h2>Qualification standard</h2>
                    <div className="criteria">
                      {[
                        "Positive multi-year profit and free cash flow",
                        "Cash conversion ≥ 80%",
                        "ROIC ≥ 15%",
                        "Net debt / EBITDA < 2×",
                        "Auditor, governance and legal checks",
                        "Margin of safety ≥ 20%",
                        "Liquidity and trend confirmation",
                        "Dated catalyst and invalidation",
                      ].map((x) => (
                        <span key={x}>{x}</span>
                      ))}
                    </div>
                    <p className="muted">
                      Thresholds are research rules, not proven return
                      predictions. Special financial sectors require separate
                      models.
                    </p>
                  </article>
                </>
              )}
              {page === "Market radar" && (
                <>
                  <div className="toolbar">
                    <div className="tabs">
                      {["ALL", "USA", "CANADA", "INDIA"].map((m) => (
                        <button
                          key={m}
                          className={market === m ? "active" : ""}
                          onClick={() => setMarket(m)}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    <span>{visible.length} results · dated daily closes</span>
                  </div>
                  <article className="panel">
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Company</th>
                            <th>Status</th>
                            <th>Close / date</th>
                            <th>Annual P/E</th>
                            <th>ROIC</th>
                            <th>Margin of safety</th>
                            <th>Next check</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map((r) => (
                            <tr key={r.id} onClick={() => setSelected(r.id)}>
                              <td>
                                <button
                                  className="text"
                                  onClick={() => setSelected(r.id)}
                                >
                                  {r.identity.symbol}
                                </button>
                                <small>
                                  {r.identity.name} · {r.identity.market}
                                </small>
                              </td>
                              <td>
                                <Status value={r.status} />
                              </td>
                              <td>
                                {money(r.price, r.identity.currency)}
                                <small>
                                  {r.priceDate ?? "Unavailable"} · {r.label}
                                </small>
                              </td>
                              <td>{fmt(r.metrics?.annualPe)}</td>
                              <td>{fmt(r.metrics?.roic)}%</td>
                              <td>
                                {fmt(
                                  r.metrics?.marginOfSafety == null
                                    ? null
                                    : r.metrics.marginOfSafety * 100,
                                )}
                                %
                              </td>
                              <td>
                                {r.reasons[0] ?? "All research gates passed"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!visible.length && (
                      <Empty text="No scan results yet. Queue a company or import a source-linked dataset." />
                    )}
                  </article>
                </>
              )}
              {page === "Research queue" && (
                <>
                  <div className="two-col">
                    <article className="panel">
                      <h2>Research a company</h2>
                      <p>
                        Requests enter a saved queue and produce a result or an
                        explicit failure.
                      </p>
                      <div className="company-list">
                        {universe.map((u) => (
                          <div className="row" key={`${u.market}:${u.symbol}`}>
                            <span>
                              <strong>{u.symbol}</strong>
                              <small>
                                {u.name} · {u.market}
                              </small>
                            </span>
                            <button
                              className="secondary"
                              onClick={() =>
                                void queue(`${u.market}:${u.symbol}`)
                              }
                            >
                              Research
                            </button>
                          </div>
                        ))}
                      </div>
                    </article>
                    <article className="panel">
                      <h2>Import verified evidence</h2>
                      <p>
                        Upload a normalized JSON dataset containing annual
                        financials, dated daily prices and an optional
                        source-linked analyst review.
                      </p>
                      <label className="upload">
                        <Upload />
                        Import research dataset
                        <input
                          type="file"
                          accept="application/json,.json"
                          onChange={(e) =>
                            void importDataset(e.target.files?.[0])
                          }
                        />
                      </label>
                      <p className="muted">
                        The repository’s data guide documents the format.
                        Missing review gates leave the company unqualified. All
                        figures must use full currency units.
                      </p>
                      <h3>Recent jobs</h3>
                      {jobs.slice(0, 12).map((j) => (
                        <div className="job" key={j.id}>
                          <strong>{j.key}</strong>
                          <Status value={j.status} />
                          <small>{when(j.updatedAt)}</small>
                          {j.error && <p className="negative">{j.error}</p>}
                        </div>
                      ))}
                      {!jobs.length && <Empty text="No jobs submitted." />}
                    </article>
                  </div>
                </>
              )}
              {page === "Evidence" && (
                <div className="two-col">
                  <article className="panel">
                    <h2>Source ledger</h2>
                    <p>
                      Keep reported facts separate from your interpretation.
                      Institutional disclosure dates are not trade dates.
                    </p>
                    {evidence
                      .slice()
                      .reverse()
                      .map((e) => (
                        <article className="evidence" key={e.id}>
                          <span className="badge">
                            {e.kind} · {e.key}
                          </span>
                          <h3>{e.date}</h3>
                          <p>{e.facts}</p>
                          <p className="muted">
                            Interpretation:{" "}
                            {e.interpretation || "None recorded"}
                          </p>
                          <a
                            href={safeUrl(e.url)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open original source ↗
                          </a>
                        </article>
                      ))}
                    {!evidence.length && (
                      <Empty text="No sourced filings, news or capital-flow evidence imported yet." />
                    )}
                  </article>
                  <form className="panel form" onSubmit={saveEvidence}>
                    <h2>Add sourced evidence</h2>
                    <label>
                      Company
                      <select name="key" required>
                        {universe.map((u) => (
                          <option key={`${u.market}:${u.symbol}`}>
                            {u.market}:{u.symbol}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Type
                      <select name="kind">
                        {[
                          "FILING",
                          "NEWS",
                          "INSIDER",
                          "INSTITUTIONAL",
                          "FII_DII",
                          "CONTRACT",
                          "RISK",
                        ].map((k) => (
                          <option key={k}>{k}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Disclosure date
                      <input name="date" type="date" required />
                    </label>
                    <label>
                      Original source URL
                      <input name="url" type="url" required />
                    </label>
                    <label>
                      Verified facts
                      <textarea name="facts" minLength={10} required />
                    </label>
                    <label>
                      Interpretation
                      <textarea name="interpretation" />
                    </label>
                    <button className="primary">Save evidence</button>
                  </form>
                </div>
              )}
              {page === "Portfolio" && (
                <article className="panel">
                  <h2>Your holdings</h2>
                  <p>
                    Manual position tracking. No brokerage account is connected.
                    No totals combine different currencies.
                  </p>
                  <label className="upload">
                    <Upload />
                    Import holdings JSON
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) => void importHoldings(e.target.files?.[0])}
                    />
                  </label>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Company</th>
                          <th>Shares</th>
                          <th>Book cost</th>
                          <th>Dated value</th>
                          <th>Unrealized P/L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {holdings.map((h) => {
                          const r = results.find(
                              (r) => r.id === `${h.market}:${h.symbol}`,
                            ),
                            value =
                              r?.price === undefined
                                ? undefined
                                : r.price * h.shares;
                          return (
                            <tr key={`${h.market}:${h.symbol}`}>
                              <td>
                                {h.symbol}
                                <small>{h.market}</small>
                              </td>
                              <td>{fmt(h.shares)}</td>
                              <td>{money(h.bookCost, h.currency)}</td>
                              <td>
                                {money(value, h.currency)}
                                <small>
                                  {r?.priceDate ?? "No verified price"}
                                </small>
                              </td>
                              <td>
                                {money(
                                  value === undefined
                                    ? undefined
                                    : value - h.bookCost,
                                  h.currency,
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {!holdings.length && (
                    <Empty text="No holdings imported. Your account information is never assumed from old chat messages." />
                  )}
                </article>
              )}
              {page === "Notifications" && (
                <article className="panel">
                  <h2>Research alert outbox</h2>
                  <p>
                    {health?.notificationConfigured
                      ? "Delivery retries automatically with a stable idempotency key."
                      : "External delivery is not configured. Alerts remain saved here."}
                  </p>
                  {alerts.map((a) => (
                    <article className="evidence" key={a.id}>
                      <div className="row">
                        <strong>{a.key}</strong>
                        <Status value={a.status} />
                      </div>
                      <p>
                        {a.result.status === "QUALIFIED"
                          ? "New qualification or reviewed thesis change"
                          : "Qualification lost — reassess thesis"}
                      </p>
                      <small>
                        {when(a.createdAt)} · {a.attempts} delivery attempts
                      </small>
                      {a.lastError && <p>{a.lastError}</p>}
                      <button
                        className="text"
                        onClick={() => {
                          setPage("Market radar");
                          setSelected(a.key);
                        }}
                      >
                        Inspect research →
                      </button>
                    </article>
                  ))}
                  {!alerts.length && (
                    <Empty text="No qualifying alerts. Unchanged candidates are not sent repeatedly." />
                  )}
                </article>
              )}
            </>
          )}
          <footer>
            Research rules are unvalidated. Source dates and missing evidence
            matter. No automatic trading.
          </footer>
        </section>
      </main>
    </div>
  );
}
function Detail({
  result: r,
  snapshot: s,
  back,
}: {
  result: ScanResult;
  snapshot?: Snapshot;
  back: () => void;
}) {
  return (
    <>
      <button className="text" onClick={back}>
        ← Back to radar
      </button>
      <article className="panel">
        <div className="row">
          <div>
            <h2>
              {r.identity.name} ({r.identity.symbol})
            </h2>
            <p>
              {r.identity.market} · {r.identity.currency} ·{" "}
              {money(r.price, r.identity.currency)} · {r.label} {r.priceDate}
            </p>
          </div>
          <Status value={r.status} />
        </div>
        <h3>Gate results</h3>
        {r.reasons.length ? (
          <ul>
            {r.reasons.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        ) : (
          <p>
            All configured research gates passed. This is not a validated
            trading signal.
          </p>
        )}
      </article>
      <div className="two-col">
        <article className="panel">
          <h2>Fundamentals</h2>
          <p className="muted">
            Annual ratios use the latest imported fiscal-year figures, not TTM.
            ROIC uses average invested capital. CAGR reports the actual
            interval.
          </p>
          {Object.entries(r.metrics ?? {}).map(([k, v]) => (
            <div className="row" key={k}>
              <span>{metricLabels[k]??k}</span>
              <strong>{metricValue(k,v,r.identity.currency)}</strong>
            </div>
          ))}
        </article>
        <article className="panel">
          <h2>Technical evidence</h2>
          <p className="muted">
            Daily adjusted OHLC · Wilder RSI / ATR · SMA-seeded EMA / MACD.
          </p>
          {Object.entries(r.technical ?? {}).map(([k, v]) => (
            <div className="row" key={k}>
              <span>{k}</span>
              <strong>{fmt(v)}</strong>
            </div>
          ))}
          <h3>Scenario valuation</h3>
          {r.review ? (
            <>
              <p>
                Bear {money(r.review.bearValue, r.identity.currency)} ·
                conservative{" "}
                {money(r.review.conservativeValue, r.identity.currency)} · bull{" "}
                {money(r.review.bullValue, r.identity.currency)}
              </p>
              <p>{r.review.valuationBasis}</p>
              <p>
                Catalyst: {r.review.catalyst} ({r.review.catalystDate})
              </p>
              <p>Invalidation: {r.review.thesisInvalidation}</p>
              <p className="muted">
                Reviewed {when(r.review.reviewedAt)} by {r.review.reviewer}
              </p>
            </>
          ) : (
            <p>No scenario review. Cannot qualify.</p>
          )}
        </article>
      </div>
      {s && (
        <article className="panel">
          <h2>Statement history</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fiscal end</th>
                  <th>Revenue</th>
                  <th>Normalized profit</th>
                  <th>OCF</th>
                  <th>Capex</th>
                  <th>Filing</th>
                </tr>
              </thead>
              <tbody>
                {s.annual.map((a) => (
                  <tr key={a.periodEnd}>
                    <td>{a.periodEnd}</td>
                    <td>{money(a.revenue, s.currency)}</td>
                    <td>{money(a.normalizedIncome, s.currency)}</td>
                    <td>{money(a.ocf, s.currency)}</td>
                    <td>{money(a.capex, s.currency)}</td>
                    <td>
                      <a
                        href={safeUrl(a.source)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {a.filedAt.slice(0, 10)} ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Provider-reported income is provisional until a reviewer checks
            normalizations and original filings.
          </p>
        </article>
      )}
    </>
  );
}
function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </article>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className={`status ${value.toLowerCase()}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="empty">{text}</p>;
}
