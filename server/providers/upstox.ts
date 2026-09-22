import { z } from 'zod';
import type { MarketQuote } from './types.js';
import { fetchJson, ProviderError } from './types.js';

const itemSchema = z.object({
  symbol: z.string().optional(),
  last_price: z.coerce.number().positive(),
  net_change: z.coerce.number().optional(),
  timestamp: z.string().optional(),
  ohlc: z.object({ close: z.coerce.number().positive() }).optional(),
});
const responseSchema = z.object({ data: z.record(z.string(), itemSchema) });

export async function getUpstoxQuote(instrumentKey: string, accessToken: string): Promise<MarketQuote> {
  const url = new URL('https://api.upstox.com/v2/market-quote/quotes');
  url.searchParams.set('instrument_key', instrumentKey);
  const parsed = responseSchema.safeParse(await fetchJson(url, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
  }));
  const quote = parsed.success ? Object.values(parsed.data.data)[0] : undefined;
  if (!quote) throw new ProviderError(502, 'Upstox returned an invalid quote');
  const changePercent = quote.ohlc?.close && quote.net_change !== undefined
    ? (quote.net_change / quote.ohlc.close) * 100 : undefined;
  return {
    market: 'INDIA', symbol: quote.symbol ?? instrumentKey, provider: 'Upstox',
    price: quote.last_price, currency: 'INR', changePercent,
    sourceTimestamp: new Date(quote.timestamp ?? Date.now()).toISOString(),
    ingestedAt: new Date().toISOString(), delayClass: 'LIVE',
  };
}
