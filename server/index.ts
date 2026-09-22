import crypto from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { z } from 'zod';
import { requireAuth, requireScope } from './auth.js';
import { config } from './config.js';

const app = express();
app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', 1);
app.use((request, response, next) => { response.setHeader('X-Request-Id', request.header('X-Request-Id') ?? crypto.randomUUID()); next(); });
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed'));
  },
  credentials: false,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
  maxAge: 600,
}));
app.use(express.json({ limit: '32kb', strict: true }));
app.use(cookieParser());
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));

app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
app.get('/api/market/status', (_request, response) => response.json({ mode: 'demo', markets: ['USA', 'CANADA', 'INDIA'], refreshTargetMinutes: 30, liveProviderConnected: false, notice: 'Production responses will include provider, source time, ingestion time, and delay class.' }));
app.get('/api/me', requireAuth, (request, response) => response.json({ subject: request.auth!.subject }));
app.get('/api/portfolio', requireAuth, requireScope('portfolio:read'), (_request, response) => response.json({
  mode: 'demo',
  currency: 'USD',
  value: 2146.80,
  notice: 'Illustrative data only. No brokerage account is connected.',
}));

const researchSchema = z.object({ ticker: z.string().trim().regex(/^[A-Z0-9.-]{1,10}$/), question: z.string().trim().min(10).max(500) });
app.post('/api/research', requireAuth, requireScope('research:write'), (request, response) => {
  const parsed = researchSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'invalid_request', fields: parsed.error.flatten().fieldErrors });
  return response.status(202).json({ status: 'queued', ticker: parsed.data.ticker, requestId: response.getHeader('X-Request-Id') });
});

app.use((_request, response) => response.status(404).json({ error: 'not_found' }));
const errors: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error({ message: error instanceof Error ? error.message : 'Unknown error' });
  response.status(500).json({ error: 'internal_error' });
};
app.use(errors);

app.listen(config.PORT, () => console.log(`Secure API listening on port ${config.PORT}`));
