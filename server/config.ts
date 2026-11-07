import { z } from "zod";
const blank = (v: unknown) => (v === "" ? undefined : v);
const optional = z.preprocess(blank, z.string().min(1).optional());
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),
  OIDC_ISSUER: z.preprocess(blank, z.string().url().optional()),
  OIDC_AUDIENCE: optional,
  OWNER_PASSWORD: z.preprocess(blank, z.string().min(20).max(256).optional()),
  OWNER_SUB: optional,
  OIDC_JWKS_URI: z.preprocess(blank, z.string().url().optional()),
  TELEGRAM_BOT_TOKEN: optional,
  TELEGRAM_CHAT_ID: optional,
  EODHD_API_TOKEN: optional,
  TWELVE_DATA_API_KEY: optional,
  UPSTOX_ACCESS_TOKEN: optional,
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
  DATA_DIR: z.string().default("./var/signaldesk"),
  SCAN_INTERVAL_MINUTES: z.coerce.number().int().min(60).default(60),
  SCAN_BATCH_SIZE: z.coerce.number().int().min(1).max(12).default(3),
  SCANNER_ENABLED: z.enum(["true", "false"]).default("true"),
  NOTIFICATION_WEBHOOK_URL: z.preprocess(
    blank,
    z.string().url().startsWith("https://").optional(),
  ),
  NOTIFICATION_WEBHOOK_SECRET: optional,
});
const p = schema.safeParse(process.env);
if (!p.success)
  throw new Error(
    `Invalid configuration fields: ${p.error.issues.map((i) => i.path.join(".")).join(", ")}`,
  );
if (Boolean(p.data.TELEGRAM_BOT_TOKEN) !== Boolean(p.data.TELEGRAM_CHAT_ID))
  throw new Error("Configure both Telegram token and chat ID");
if (p.data.OWNER_PASSWORD && p.data.OIDC_ISSUER)
  throw new Error("Choose password or OIDC authentication, not both");
if (Boolean(p.data.OIDC_ISSUER) !== Boolean(p.data.OIDC_AUDIENCE))
  throw new Error("Configure both OIDC issuer and audience");
if (
  p.data.NODE_ENV === "production" &&
  p.data.OIDC_ISSUER &&
  !p.data.OIDC_ISSUER.startsWith("https://")
)
  throw new Error("Production issuer must use HTTPS");
if (
  p.data.NODE_ENV === "production" &&
  p.data.OIDC_JWKS_URI &&
  !p.data.OIDC_JWKS_URI.startsWith("https://")
)
  throw new Error("Production JWKS must use HTTPS");
if (
  p.data.NODE_ENV === "production" &&
  !p.data.OWNER_PASSWORD && (!p.data.OIDC_ISSUER || !p.data.OWNER_SUB)
)
  throw new Error("Production requires OWNER_PASSWORD or OIDC authentication with OWNER_SUB");
export const config = {
  ...p.data,
  authEnabled: Boolean(p.data.OIDC_ISSUER || p.data.OWNER_PASSWORD),
  host: (p.data.OIDC_ISSUER || p.data.OWNER_PASSWORD) ? "0.0.0.0" : "127.0.0.1",
  allowedOrigins: new Set([
    ...p.data.ALLOWED_ORIGINS.split(",").map((x) => x.trim()),
    ...(process.env.RENDER_EXTERNAL_URL ? [new URL(process.env.RENDER_EXTERNAL_URL).origin] : []),
  ]),
  trustProxy: p.data.TRUST_PROXY === "true",
};
