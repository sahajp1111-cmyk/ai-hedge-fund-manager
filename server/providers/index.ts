import { config } from '../config.js';
import { getEodhdQuote } from './eodhd.js';
import { getTwelveDataQuote } from './twelveData.js';
import type { Market, MarketQuote, ProviderStatus } from './types.js';
import { ProviderError } from './types.js';
import { getUpstoxQuote } from './upstox.js';

const cache = new Map<string, { expiresAt: number; quote: MarketQuote }>();

export function providerStatuses(): ProviderStatus[] {
  return [
    { provider: 'Twelve Data', configured: Boolean(config.TWELVE_DATA_API_KEY), markets: ['USA'], delayClass: 'LIVE', purpose: 'Real-time U.S. quotes; free tier has daily limits.' },
    { provider: 'EODHD', configured: Boolean(config.EODHD_API_TOKEN), markets: ['CANADA', 'INDIA'], delayClass: 'DELAYED', purpose: 'Global intraday/history and Canadian coverage.' },
    { provider: 'Upstox', configured: Boolean(config.UPSTOX_ACCESS_TOKEN), markets: ['INDIA'], delayClass: 'LIVE', purpose: 'Live Indian quotes through the investor account.' },
  ];
}

export async function getMarketQuote(market: Market, symbol: string): Promise<MarketQuote> {
  const key = `${market}:${symbol}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.quote;

  let quote: MarketQuote;
  if (market === 'USA' && config.TWELVE_DATA_API_KEY) {
    quote = await getTwelveDataQuote(symbol, config.TWELVE_DATA_API_KEY);
  } else if (market === 'INDIA' && config.UPSTOX_ACCESS_TOKEN) {
    quote = await getUpstoxQuote(symbol, config.UPSTOX_ACCESS_TOKEN);
  } else if (market !== 'USA' && config.EODHD_API_TOKEN) {
    quote = await getEodhdQuote(market, symbol, config.EODHD_API_TOKEN);
  } else {
    throw new ProviderError(503, `No ${market} market-data provider is configured`);
  }

  const ttlMs = quote.delayClass === 'LIVE' ? 30_000 : 15 * 60_000;
  cache.set(key, { quote, expiresAt: Date.now() + ttlMs });
  return quote;
}
