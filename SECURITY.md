# Security policy

SignalDesk is single-owner research software. It has no order endpoints or brokerage credentials.

## Authentication and data

Production requires asymmetric OIDC access-token verification (issuer, audience, expiry and signature), an explicit allowed owner subject, and per-route scopes. The current UI accepts a short-lived bearer access token in memory; it is never saved in localStorage or committed. Obtain access tokens through your identity provider's Authorization Code + PKCE client. No password collection or hosted sign-in flow is included. Do not expose a permanent access token as browser configuration.

Development without OIDC binds exclusively to 127.0.0.1 and explicitly reports local mode. Never tunnel or reverse-proxy that mode to the public internet. Production refuses to start without issuer, audience and owner configuration.

All `/api` mutations validate input. Foreign browser origins are explicitly rejected; CORS is restricted, credentials are not sent automatically by the UI, and no cookie-based sessions are used. The API sets security headers and rate limits. Tokens, keys and raw provider errors must never appear in persisted jobs or alerts.

Provider keys and notification credentials stay server-side. Never use `VITE_*` for secrets. `.env`, private state, holdings, backups and historical datasets must stay outside git/static hosting. Disk state uses private filesystem permissions and atomic replacement, but encryption at rest is an operator responsibility: deploy on encrypted volumes with encrypted backups and restricted access. The app does not claim application-level encryption or key rotation.

Notification webhooks must use HTTPS, refuse redirects, and should validate the optional HMAC signature and idempotency key. Research alerts may contain private research; configure only destinations you own. Tests mock external delivery and never send to real recipients.

Report suspected secrets privately to the repository owner and revoke affected credentials. Never post tokens, private positions or raw state in public issues.
