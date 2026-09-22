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
