# Private personal dashboard on Render

This configuration runs one owner-authenticated web service, with the research worker in the same process and a 1 GB persistent disk. The network-facing login page is reachable over HTTPS; research, portfolio and data endpoints require authentication. There is no public registration. This is application access control, not a VPN or network-private endpoint.

## Private setup

1. Review the Blueprint service and cost in Render before applying it. The specified 0.5c-512mb compute plan is currently US$7/month and disk is US$0.25/GB/month: US$7.25/month base, excluding workspace charges, metered usage, tax and data subscriptions. Review the actual plan before paying.
2. Set `OWNER_PASSWORD` in Render to a unique passphrase of 20–256 characters, preferably generated and saved in your password manager. Never put it in GitHub, a chat message or a VITE variable. Do not configure OIDC at the same time.
3. Set `EODHD_API_TOKEN` privately. Verify the account's historical data, fundamentals and required exchange entitlements; a key alone is not verification. A missing key produces unavailable scans. This Blueprint does not purchase market data or grant real-time exchange entitlements.
4. Deploy, open the service's HTTPS URL, and sign in with that passphrase. The Render external URL is added to allowed origins automatically. Custom domains need their exact origin added to `ALLOWED_ORIGINS`.
5. Verify the provider status, first completed scan, quote dates, data errors and coverage. Research uses daily closing bars; intraday quote adapters remain conservatively labelled delayed. Do not describe this as continuous real-time monitoring.
6. For delivery outside the dashboard, add your own Telegram credentials or webhook in Render following OPERATIONS.md, then test delivery. Without them, alerts remain in the private in-app outbox.

Sessions use HttpOnly, Secure, SameSite=Strict cookies on production HTTPS, expire after eight hours and are invalidated at restart/redeploy. Sign-out invalidates the server session. Restart after changing the passphrase to revoke all sessions. The login endpoint is rate limited. This single-owner option does not include MFA, additional users or an email reset flow; manage recovery through Render secrets. Sessions and login limits are in memory: run exactly one replica.

The disk keeps research data across deploys. A disk prevents zero-downtime deployments. See OPERATIONS.md for backups and stale writer-lock recovery after an ungraceful stop. The health endpoint checks process liveness only; it does not certify market-data access or scan success. Auto-deploy is off: review and explicitly deploy later changes.
