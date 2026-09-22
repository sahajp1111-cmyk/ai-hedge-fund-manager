# SignalDesk — AI Hedge Fund Manager

AI-powered investment research, portfolio analysis, market intelligence, and decision support.

## Implemented milestones

- Responsive institutional-style dashboard
- Portfolio, market radar, AI research, news, and flow navigation
- Performance, holdings, risk, opportunity, and market-pulse cards
- Security-first integration rules in `SECURITY.md`
- Sample data only: no brokerage credentials or real transactions
- Functional U.S./Canada/India market radar with market-cap filters
- Boring-business, essential-infrastructure, and underfollowed-company tags
- Institutional, insider, ETF, FII, and DII flow framework with delay labels
- Transparent opportunity scoring and hard research-rejection gates
- News-intelligence and evidence-checklist workspace
- CI builds the Vite client and secure TypeScript API on Node 20 and 22
- Budget-aware provider adapters for U.S., Canadian, and Indian quotes
- Server-side quote cache, input validation, timeouts, and source/freshness metadata

## Market-data plan (maximum C$50/month)

| Market | Provider | Budget role | Expected label |
| --- | --- | --- | --- |
| United States | Twelve Data Basic | Free real-time quote allowance | `LIVE` |
| Canada | EODHD All World Extended | Included in US$29.99/month global plan | `DELAYED` |
| India | Upstox API | Free live data with an Upstox account | `LIVE` |
| Global fallback | EODHD | History and intraday for international symbols | `DELAYED` |

Exchange entitlements and provider terms control actual availability. The application never presents delayed or end-of-day data as live.

## Data integrity boundary

The repository is public and contains fictional demonstration companies and holdings only. Live feeds require licensed server-side providers. Every production observation must carry a provider, source timestamp, ingestion timestamp, and one of `LIVE`, `DELAYED`, `FILING`, or `ESTIMATE`.

## Run locally

```bash
npm install
npm run dev
```

Run `npm run build` before deployment.

## Secure API

The `server/` application validates OpenID Connect access tokens against the provider's remote JWKS. Protected routes require both a valid token and the appropriate scope.

1. Copy `.env.example` to `.env`.
2. Configure `OIDC_ISSUER`, `OIDC_AUDIENCE`, and the exact allowed frontend origin.
3. Run `npm run dev:api` and `npm run dev` in separate terminals.

The API includes security headers, strict CORS, request size limits, rate limiting, schema validation, generic error responses, and request IDs. Real credentials remain server-side.

### Configure market data

Add only the keys you have to the server environment. The app remains in demonstration mode when none are configured.

```bash
EODHD_API_TOKEN=server-only-token
TWELVE_DATA_API_KEY=server-only-key
UPSTOX_ACCESS_TOKEN=short-lived-server-only-token
```

Test a quote after starting the API:

```bash
curl "http://localhost:8787/api/market/quote?market=USA&symbol=AAPL"
curl "http://localhost:8787/api/market/quote?market=CANADA&symbol=SHOP.TO"
curl "http://localhost:8787/api/market/quote?market=INDIA&symbol=NSE_EQ%7CINE002A01018"
```

Upstox access tokens are short-lived. A later private deployment milestone will add the authorization callback and encrypted token rotation; never commit or paste access tokens into issues or chat.
