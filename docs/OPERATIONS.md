# Operations

## Production

Use one always-on Node service with a persistent filesystem and HTTPS reverse proxy. A static site alone cannot run the worker or save private research.

1. Copy `.env.example` to a PRIVATE `.env`.
2. Configure `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OWNER_SUB` and an exact `ALLOWED_ORIGINS` list. The accepted issuer must use the configured JWKS URI (or Auth0-style default). Request scopes `research:read research:write portfolio:read portfolio:write` on the access token. The UI accepts a short-lived access token in memory; a hosted OAuth sign-in flow is not bundled.
3. Configure optional provider secrets and your notification destination. Verify licensing/entitlements directly; do not assume one product includes fundamentals.
4. `docker compose up --build -d`. Compose binds the host port to loopback; terminate HTTPS at your reverse proxy. Set TRUST_PROXY only when the network guarantees all ingress passes through your trusted proxy.
5. Verify `/api/health` for liveness, then sign in and verify data status, last scan coverage, errors, source dates and the notification outbox. Liveness does not guarantee a working provider.

No credentials were created or connected during implementation. No automated securities orders exist. External notification delivery requires your own destination configuration and should be tested with a non-sensitive research event first.

## Storage and recovery

`DATA_DIR/state.json` contains positions, source snapshots, jobs, alerts and price history. It is written with atomic rename and private filesystem modes. A serialized write queue prevents lost concurrent updates; a process lock excludes a second writer. Restart requeues interrupted jobs. Run exactly one service replica.

The state file is NOT application-encrypted: use an encrypted persistent volume, private access permissions and encrypted backups. Do not place it in a public static folder or git. Atomic rename is not a promise against all power-loss/filesystem failures. Back up the directory and test restoration. If a process is killed without graceful shutdown, confirm it is no longer running before manually removing `writer.lock`; never remove another active process's lock.

To restore: stop service, restore the directory from a trusted backup, confirm no other process owns the lock, restart. Corrupt/unsupported state fails startup instead of silently discarding data. Jobs retain 30 days; evidence and alert records persist for audit. Monitor disk use.

## Cadence, costs and coverage

The default hourly tick rotates three companies, one per market, over twelve real-company identifiers. A manual research request may add up to three extra queued companies. History is cached for six hours, fundamentals for seven days. Missing fields never count as passes. A refreshed snapshot loses its old analyst review until reassessed. The scanner never claims full-exchange coverage.

Change `UNIVERSE_FILE` to a PRIVATE JSON array of `{symbol, name, market, currency, providerSymbol}` (maximum 50, unique market/symbol keys). Restart after changes. Verify exact provider listing symbols; defaults are research candidates, not prequalified recommendations. Increasing coverage can increase provider costs.

## Notifications

The private in-app outbox always stores alerts. Configure either:

- `NOTIFICATION_WEBHOOK_URL`: HTTPS endpoint you control. It receives JSON with event, alert ID and full research result. Optional `NOTIFICATION_WEBHOOK_SECRET` signs raw JSON via HMAC-SHA256 in `X-SignalDesk-Signature`. Validate signature and deduplicate using `Idempotency-Key`.
- `TELEGRAM_BOT_TOKEN` plus `TELEGRAM_CHAT_ID`: your own bot and private destination. Both are required. Never commit these secrets.

Webhook redirects are refused. Delivery is at-least-once, not exactly-once; recipients should deduplicate. Failed sends retry on worker ticks with exponential backoff, max eight attempts. If no destination is configured, alerts stay pending. Distinguish queued alerts from successfully sent messages. Do not send private account or brokerage credentials in alerts.

## Security boundaries

Production startup requires OIDC and a specific owner subject. Local no-auth mode listens only on loopback; do not expose it through a tunnel/reverse proxy. Foreign browser origins are rejected on API routes. All research/position endpoints require appropriate scopes in authenticated mode. Tokens stay in browser memory and are cleared on disconnect/reload. Credentials stay server-side. The data directory is private, but disk encryption/backups remain an operator responsibility.
