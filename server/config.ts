import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  OIDC_ISSUER: z.string().url(),
  OIDC_AUDIENCE: z.string().min(1),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`Invalid server configuration: ${names}. Copy .env.example and configure OIDC.`);
}

export const config = {
  ...parsed.data,
  allowedOrigins: new Set(parsed.data.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())),
  trustProxy: parsed.data.TRUST_PROXY === 'true',
};
