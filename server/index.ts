import crypto from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { z } from 'zod';
import { requireAuth, requireScope } from './auth.js';
import { config } from './config.js';
import { getMarketQuote, providerStatuses } from './providers/index.js';
import { ProviderError } from './providers/types.js';

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
app.get('/api/market/status', (_request, response) => {
  const providers = providerStatuses();
  response.json({
    mode: providers.some((provider) => provider.configured) ? 'provider-ready' : 'demo',
    markets: ['USA', 'CANADA', 'INDIA'], refreshTargetMinutes: 30,
    liveProviderConnected: providers.some((provider) => provider.configured && provider.delayClass === 'LIVE'),
    providers,
    notice: 'Every quote identifies its provider, source time, ingestion time, and delay class.',
  });
});
const quoteQuery = z.object({
  market: z.enum(['USA', 'CANADA', 'INDIA']),
  symbol: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9._|:-]+$/),
});
app.get('/api/market/quote', async (request, response, next) => {
  const parsed = quoteQuery.safeParse(request.query);
  if (!parsed.success) return response.status(400).json({ error: 'invalid_market_or_symbol' });
  try { return response.json(await getMarketQuote(parsed.data.market, parsed.data.symbol)); }
  catch (error) { return next(error); }
});
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
  if (error instanceof ProviderError) return response.status(error.status).json({ error: 'market_data_error', message: error.message });
  response.status(500).json({ error: 'internal_error' });
};
app.use(errors);

app.listen(config.PORT, () => console.log(`Secure API listening on port ${config.PORT}`));
