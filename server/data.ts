import { z } from "zod";
import { bar, snapshot, type Snapshot, type Bar } from "../shared/schema.js";
import type { Security } from "./universe.js";
import { ProviderError, fetchJson } from "./providers/types.js";
const object = (x: unknown): Record<string, any> =>
  x && typeof x === "object" && !Array.isArray(x)
    ? (x as Record<string, any>)
    : {};
const num = (x: unknown): number => {
  if (x === null || x === undefined || x === "")
    throw new Error("Missing financial value");
  const n = Number(x);
  if (!Number.isFinite(n)) throw new Error("Invalid financial number");
  return n;
};
export class EodData {
  constructor(private token?: string) {}
  private async request(endpoint: string, symbol: string) {
    if (!this.token)
      throw new ProviderError(
        503,
        "EODHD key missing: configure history access or import a verified dataset",
      );
    const u = new URL(
      `https://eodhd.com/api/${endpoint}/${encodeURIComponent(symbol)}`,
    );
    u.searchParams.set("api_token", this.token);
    u.searchParams.set("fmt", "json");
    if (endpoint === "eod") {
      u.searchParams.set(
        "from",
        new Date(Date.now() - 550 * 86400000).toISOString().slice(0, 10),
      );
      u.searchParams.set("order", "a");
    }
    return fetchJson(u);
  }
  async history(s: Security): Promise<Bar[]> {
    const raw = z
      .array(
        z.object({
          date: z.string(),
          open: z.number(),
          high: z.number(),
          low: z.number(),
          close: z.number(),
          adjusted_close: z.number().positive(),
          volume: z.number(),
        }),
      )
      .parse(await this.request("eod", s.providerSymbol));
    // Same adjustment factor on every OHLC field. Avoid split/dividend discontinuities in indicators.
    // Volume remains provider volume; turnover is calculated against the latest close only.
    return z.array(bar).parse(
      raw.map((r) => {
        const f = r.adjusted_close / r.close;
        return {
          date: r.date,
          open: r.open * f,
          high: r.high * f,
          low: r.low * f,
          close: r.adjusted_close,
          volume: r.volume,
        };
      }),
    );
  }
  async fundamentals(s: Security): Promise<Snapshot> {
    return mapFundamentals(
      s,
      await this.request("fundamentals", s.providerSymbol),
    );
  }
}
export function mapFundamentals(s: Security, raw: unknown): Snapshot {
  const data = object(raw),
    g = object(data.General),
    f = object(data.Financials);
  if (g.Code !== s.symbol || g.CurrencyCode !== s.currency)
    throw new Error("Provider security/currency mismatch");
  for (const key of ["Income_Statement", "Balance_Sheet", "Cash_Flow"])
    if (object(f[key]).currency_symbol !== s.currency)
      throw new Error("Statement currency mismatch or unavailable");
  const income = object(object(f.Income_Statement).yearly),
    balance = object(object(f.Balance_Sheet).yearly),
    cash = object(object(f.Cash_Flow).yearly);
  const annual = Object.keys(income)
    .sort()
    .slice(-11)
    .flatMap((date) => {
      try {
        const i = object(income[date]),
          b = object(balance[date]),
          c = object(cash[date]);
        const net = num(i.netIncome),
          shares = num(b.commonStockSharesOutstanding),
          equity = num(b.totalStockholderEquity),
          debt = num(b.shortLongTermDebtTotal),
          liquid = num(b.cashAndShortTermInvestments);
        const ebit = num(i.ebit),
          pretax = num(i.incomeBeforeTax),
          tax = num(i.incomeTaxExpense);
        const filing = [i.filing_date, b.filing_date, c.filing_date];
        if (filing.some((d) => typeof d !== "string")) return [];
        return [
          {
            periodEnd: date,
            filedAt: filing.sort().at(-1) + "T23:59:59Z",
            revenue: num(i.totalRevenue),
            netIncome: net,
            normalizedIncome: net,
            ocf: num(c.totalCashFromOperatingActivities),
            capex: Math.abs(num(c.capitalExpenditures)),
            eps: net / shares,
            shares,
            equity,
            ebit,
            ebitda: num(i.ebitda),
            interest: Math.abs(num(i.interestExpense)),
            taxRate: pretax > 0 ? tax / pretax : NaN,
            investedCapital: equity + debt - liquid,
            debt,
            cash: liquid,
            source: `https://eodhd.com/api/fundamentals/${encodeURIComponent(s.providerSymbol)}`,
          },
        ];
      } catch {
        return [];
      }
    });
  // Reported net income is a provisional normalization proxy. No automatic analyst PASS review.
  return snapshot.parse({
    ...s,
    sector: /bank|insurance|reit/i.test(String(g.Industry))
      ? "BANK"
      : "NONFINANCIAL",
    asOf: new Date().toISOString(),
    source: `https://eodhd.com/financial-summary/${encodeURIComponent(s.providerSymbol)}`,
    annual,
    capitalization:
      object(data.SharesStats).SharesOutstanding &&
      typeof g.UpdatedAt === "string"
        ? {
            shares: num(object(data.SharesStats).SharesOutstanding),
            asOf: g.UpdatedAt.slice(0, 10) + "T00:00:00Z",
            source: `https://eodhd.com/financial-summary/${encodeURIComponent(s.providerSymbol)}`,
          }
        : undefined,
  });
}
