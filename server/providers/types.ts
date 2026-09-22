export type Market = 'USA' | 'CANADA' | 'INDIA';
export type DelayClass = 'LIVE' | 'DELAYED' | 'EOD' | 'UNAVAILABLE';

export type MarketQuote = {
  market: Market;
  symbol: string;
  provider: 'Twelve Data' | 'EODHD' | 'Upstox';
  price: number;
  currency?: string;
  changePercent?: number;
  sourceTimestamp: string;
  ingestedAt: string;
  delayClass: DelayClass;
};

export type ProviderStatus = {
  provider: MarketQuote['provider'];
  configured: boolean;
  markets: Market[];
  delayClass: DelayClass;
  purpose: string;
};

export class ProviderError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export async function fetchJson(url: URL, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new ProviderError(502, `Market-data provider returned ${response.status}`);
  return response.json();
}
