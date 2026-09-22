import { z } from 'zod';
import type { MarketQuote } from './types.js';
import { fetchJson, ProviderError } from './types.js';

const responseSchema = z.object({
  symbol: z.string(),
  close: z.coerce.number().positive(),
  currency: z.string().optional(),
  percent_change: z.coerce.number().optional(),
  timestamp: z.coerce.number().int().positive().optional(),
  datetime: z.string().optional(),
});

export async function getTwelveDataQuote(symbol: string, apiKey: string): Promise<MarketQuote> {
  const url = new URL('https://api.twelvedata.com/quote');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('apikey', apiKey);
  const parsed = responseSchema.safeParse(await fetchJson(url));
  if (!parsed.success) throw new ProviderError(502, 'Twelve Data returned an invalid quote');
  const sourceTimestamp = parsed.data.timestamp
    ? new Date(parsed.data.timestamp * 1_000).toISOString()
    : new Date(parsed.data.datetime ?? Date.now()).toISOString();
  return {
    market: 'USA', symbol: parsed.data.symbol, provider: 'Twelve Data',
    price: parsed.data.close, currency: parsed.data.currency,
    changePercent: parsed.data.percent_change, sourceTimestamp,
    ingestedAt: new Date().toISOString(), delayClass: 'LIVE',
  };
}
