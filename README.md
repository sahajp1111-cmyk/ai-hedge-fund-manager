# SignalDesk — AI Hedge Fund Manager

AI-powered investment research, portfolio analysis, market intelligence, and decision support.

## First milestone

- Responsive institutional-style dashboard
- Portfolio, market radar, AI research, news, and flow navigation
- Performance, holdings, risk, opportunity, and market-pulse cards
- Security-first integration rules in `SECURITY.md`
- Sample data only: no brokerage credentials or real transactions

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
