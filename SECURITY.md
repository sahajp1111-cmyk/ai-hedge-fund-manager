# Security policy

## Current boundary

This first milestone is a client-side dashboard prototype using sample data. It does not collect passwords, brokerage credentials, personal access tokens, or execute trades.

The API foundation validates asymmetric OIDC access tokens using the provider's published JWKS. It does not accept passwords, issue its own long-lived tokens, or store tokens in the browser. Authentication is deny-by-default when OIDC configuration is missing or invalid.

## Mandatory rules for integrations

- Never put secrets in `VITE_*` variables because Vite exposes them to the browser.
- Keep brokerage, market-data, AI-provider, and database credentials on the server.
- Use an OpenID Connect provider with Authorization Code + PKCE for sign-in.
- Store sessions in `Secure`, `HttpOnly`, `SameSite=Lax` cookies, not local storage.
- Validate token issuer, audience, signature, expiry, and nonce.
- Authorize every API route independently and validate all request schemas.
- Add CSRF protection, strict CORS, security headers, rate limits, audit logs, encryption, and key rotation.
- Require explicit human confirmation for every trade; research signals must never trade automatically.

Local `.env` and Streamlit secret files are already ignored by Git. Production secrets belong in an encrypted deployment secret manager. Never report a leaked secret in a public issue; revoke it immediately and contact the repository owner privately.
