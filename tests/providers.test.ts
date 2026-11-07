import { test } from "node:test";
import assert from "node:assert/strict";
import { mapFundamentals, EodData } from "../server/data.js";
import { getUpstoxQuote } from "../server/providers/upstox.js";
import { getTwelveDataQuote } from "../server/providers/twelveData.js";
import { universe } from "../server/universe.js";
test("Provider normalization rejects absent numeric values, missing filing dates and wrong currency; never invents a review", () => {
  const years = ["2023-09-30", "2024-09-30", "2025-09-30"];
  const income = Object.fromEntries(
    years.map((date, i) => [
      date,
      {
        netIncome: String(100 + i * 10),
        ebit: "150",
        incomeBeforeTax: "140",
        incomeTaxExpense: "35",
        filing_date: date,
        totalRevenue: "1000",
        ebitda: "180",
        interestExpense: "10",
      },
    ]),
  );
  const balance = Object.fromEntries(
    years.map((date) => [
      date,
      {
        commonStockSharesOutstanding: "100",
        totalStockholderEquity: "500",
        shortLongTermDebtTotal: "100",
        cashAndShortTermInvestments: "50",
        filing_date: date,
      },
    ]),
  );
  const cash = Object.fromEntries(
    years.map((date) => [
      date,
      {
        filing_date: date,
        totalCashFromOperatingActivities: "150",
        capitalExpenditures: "-20",
      },
    ]),
  );
  const raw = {
    General: {
      Code: "MWA",
      CurrencyCode: "USD",
      Industry: "Industrial",
      UpdatedAt: "2026-11-01",
    },
    SharesStats: { SharesOutstanding: "100" },
    Financials: {
      Income_Statement: { currency_symbol: "USD", yearly: income },
      Balance_Sheet: { currency_symbol: "USD", yearly: balance },
      Cash_Flow: { currency_symbol: "USD", yearly: cash },
    },
  };
  const s = mapFundamentals(universe.find((x) => x.symbol === "MWA")!, raw);
  assert.equal(s.annual[0].capex, 20);
  assert.equal(s.review, undefined);
  assert.throws(
    () =>
      mapFundamentals(universe.find((x) => x.symbol === "MWA")!, {
        ...raw,
        General: { ...raw.General, CurrencyCode: "CAD" },
      }),
    /mismatch/,
  );
  income[years[0]].netIncome = "";
  assert.throws(() =>
    mapFundamentals(universe.find((x) => x.symbol === "MWA")!, raw),
  );
});
test("Quote timestamps and adjusted OHLC are validated; missing time is not replaced with now", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      Response.json({ symbol: "MWA", close: "24" });
    await assert.rejects(
      getTwelveDataQuote("MWA", "test"),
      /timestamp missing/,
    );
    globalThis.fetch = async () =>
      Response.json({
        data: {
          "NSE_EQ:TEST": {
            symbol: "TEST",
            last_price: 100,
            last_trade_time: "1793984400000",
          },
        },
      });
    const quote = await getUpstoxQuote("NSE_EQ|TEST", "test");
    assert.equal(quote.sourceTimestamp, new Date(1793984400000).toISOString());
    assert.equal(quote.delayClass, "DELAYED");
    globalThis.fetch = async () =>
      Response.json([
        {
          date: "2026-11-06",
          open: 100,
          high: 110,
          low: 90,
          close: 100,
          adjusted_close: 50,
          volume: 1000,
        },
      ]);
    const bars = await new EodData("test").history(universe[0]);
    assert.deepEqual(
      [bars[0].open, bars[0].high, bars[0].low, bars[0].close],
      [50, 55, 45, 50],
    );
  } finally {
    globalThis.fetch = original;
  }
});
