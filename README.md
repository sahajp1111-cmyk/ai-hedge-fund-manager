# SignalDesk — investment research scanner

A single-owner research application for US, Canadian and Indian listed companies. Includes a real persistent queue, rotating scanner, source ledger, manual portfolio, analyst review gates, scenario valuation, technical analysis and retryable notifications. There are no brokerage connections or trade orders.

## Start locally

Requires Node **22.12+ or 24**. No credentials are needed to start the application or import your own verified data.

```bash
npm ci
cp .env.example .env
npm test
npm run build
npm run start:api
```

Open `http://127.0.0.1:8787`. Without OIDC, the server binds only to loopback. An empty workspace is intentional: no fictional companies, returns or holdings are displayed as real data. Without a provider or imported dataset, scans explicitly report `UNAVAILABLE`.

For frontend development, run `npm run dev:api` and `npm run dev` in separate terminals, and set browser-safe `VITE_API_BASE_URL=http://127.0.0.1:8787` in `.env`.

## What is implemented

- Responsive dashboard connected to saved API results, not static sample candidates.
- Rotating real-company universe across USA/Canada/India (12 default; configurable up to 50).
- EODHD daily history and annual fundamentals adapter, cached history and statements.
- Real research jobs with persisted queued/running/completed/failed states and restart recovery.
- Typed, validated financial imports with filing dates, full currency units, currency/security checks and current share counts.
- Normalized-profit/OCF/FCF, ROIC, debt, interest, dilution, growth, liquidity, trend, governance, auditor, legal and valuation gates.
- Annual P/E (explicitly not TTM), forward P/E, supported forward PEG, actual-interval and 3/5/10-year CAGR where data permits, FCF yield, EV/EBITDA, P/B and scenario returns.
- Correctly aligned MACD/signal, Wilder RSI/ATR, SMA20/50/200, relative volume and observed support/resistance.
- Private, source-linked filing/news/institutional/insider/FII-DII evidence ledger. Facts and interpretation stay separate.
- Manual holdings import with dated values and per-currency P/L; no stale chat-position assumptions.
- Deduplicated alert outbox, signed HTTPS webhook, optional Telegram mobile delivery, retry/backoff and stable idempotency keys.
- Point-in-time walk-forward evaluator with leakage checks, non-overlapping outcome cohorts, costs and benchmark comparisons.
- Single-owner OIDC protection, scope checks, input validation, CORS, rate limits, security headers and private storage.
- Build/test CI and Docker deployment with persistent storage.

## Data boundaries

This is **research software, not a validated investment strategy**. Passing the configured gates creates a research candidate, never a trade instruction. Ranking weights from Capital Radar v1–v3 remain experimental library functions; production qualification uses explicit gates, not their uncalibrated score.

All scanner observations are dated daily **CLOSE** prices, not continuous real-time feeds. Quote adapters retain conservative delay labels. A configured credential is not a verified connection. A source timestamp is never replaced with the ingestion time when missing.

The EODHD adapter requires history and fundamentals entitlements. The old C$50 plan was a budget aspiration, not a verified entitlement or enforced billing limit. No paid plan is purchased by this code. Set the batch size/cadence to suit your provider allowance.

Provider-reported net income is a provisional normalization proxy. An analyst must inspect original statements, cash conversion, contingent liabilities, working capital, dilution, governance and scenarios before a candidate can qualify. The software cannot independently attest to all legal/accounting facts. No automatic web-news, SEC/SEDAR+/NSE filing crawler, institutional trade inference, brokerage sync or LLM-generated due diligence is claimed; external disclosures can be entered in the evidence ledger and imported review.

Banks, insurers and REITs remain `RESEARCH` pending sector-specific models. Current API access does not provide historical point-in-time data by itself. No backtest results are fabricated.

## Configure data and alerts

Set only server environment variables from `.env.example`. Never put provider secrets in `VITE_*`, the repository, a GitHub issue or chat.

See [data format and sources](docs/DATA.md), [operations and deployment](docs/OPERATIONS.md), and [validation protocol](docs/VALIDATION.md).

Notifications require either your own HTTPS receiving endpoint or your own Telegram bot/chat configuration. Alerts remain in the private in-app outbox when no destination is configured. This application does not send ChatGPT push notifications and is separate from ChatGPT scheduled tasks.

## Verification

```bash
npm test
npm run build
npm run calibrate -- /private/observations.json /private/calibration-report.json
```

Tests include indicator reference calculations, failed qualification gates, stale/future data, persistent jobs, API import/portfolio/evidence, notification retries/deduplication and look-ahead rejection. Synthetic fixtures are clearly labeled and never loaded on startup.
