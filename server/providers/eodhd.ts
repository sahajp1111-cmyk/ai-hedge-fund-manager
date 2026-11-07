import { z } from "zod";
import type { Market, MarketQuote } from "./types.js";
import { fetchJson, ProviderError } from "./types.js";

const responseSchema = z.object({
  code: z.string(),
  timestamp: z.coerce.number().int().positive(),
  close: z.coerce.number().positive(),
  change_p: z.coerce.number().optional(),
});

export async function getEodhdQuote(
  market: Market,
  symbol: string,
  token: string,
): Promise<MarketQuote> {
  const url = new URL(
    `https://eodhd.com/api/real-time/${encodeURIComponent(symbol)}`,
  );
  url.searchParams.set("api_token", token);
  url.searchParams.set("fmt", "json");
  const parsed = responseSchema.safeParse(await fetchJson(url));
  if (!parsed.success)
    throw new ProviderError(502, "EODHD returned an invalid quote");
  if (parsed.data.code.toUpperCase() !== symbol.toUpperCase())
    throw new ProviderError(502, "EODHD quote symbol does not match the request");
  if (parsed.data.timestamp * 1000 > Date.now() + 5 * 60_000)
    throw new ProviderError(502, "EODHD quote timestamp is in the future");
  return {
    market,
    symbol: parsed.data.code,
    provider: "EODHD",
    price: parsed.data.close,
    changePercent: parsed.data.change_p,
    sourceTimestamp: new Date(parsed.data.timestamp * 1_000).toISOString(),
    ingestedAt: new Date().toISOString(),
    delayClass: "DELAYED",
  };
}
