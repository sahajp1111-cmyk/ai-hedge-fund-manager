import type { Snapshot, Bar } from "../shared/schema.js";
export function fixture() {
  const now = new Date("2026-11-06T22:00:00Z");
  const bars: Bar[] = Array.from({ length: 260 }, (_, i) => {
    const c = 60 + i * 0.12 + Math.sin(i / 3) * 2;
    return {
      date: new Date(now.getTime() - (259 - i) * 86400000)
        .toISOString()
        .slice(0, 10),
      open: c - 0.1,
      high: c + 1,
      low: c - 1,
      close: c,
      volume: 1000000,
    };
  });
  const snapshot: Snapshot = {
    symbol: "MWA",
    market: "USA",
    currency: "USD",
    name: "SYNTHETIC TEST — NOT MUELLER FINANCIALS",
    sector: "NONFINANCIAL",
    asOf: now.toISOString(),
    capitalization: {
      shares: 100,
      asOf: now.toISOString(),
      source: "https://example.test/synthetic",
    },
    source: "https://example.test/synthetic",
    annual: [2023, 2024, 2025].map((year, i) => ({
      periodEnd: `${year}-12-31`,
      filedAt: `${year + 1}-02-20T12:00:00Z`,
      revenue: 1000 * 1.12 ** i,
      netIncome: 150 * 1.12 ** i,
      normalizedIncome: 150 * 1.12 ** i,
      ocf: 180 * 1.12 ** i,
      capex: 20,
      eps: 1.5 * 1.12 ** i,
      shares: 100,
      equity: 500,
      ebit: 200,
      ebitda: 220,
      interest: 5,
      taxRate: 0.25,
      investedCapital: 600,
      debt: 100,
      cash: 50,
      source: "https://example.test/synthetic",
    })),
    review: {
      reviewedAt: now.toISOString(),
      reviewer: "SYNTHETIC TEST",
      sources: ["https://example.test/synthetic"],
      audit: "PASS",
      governance: "PASS",
      legal: "PASS",
      workingCapital: "PASS",
      catalyst: "Synthetic test catalyst, not an actual corporate event",
      catalystDate: "2027-02-20",
      thesisInvalidation: "Synthetic test earnings deterioration",
      notes: "This is entirely generated test data.",
      conservativeValue: 160,
      bearValue: 60,
      bullValue: 220,
      valuationBasis:
        "Synthetic test scenario, no actual market or company valuation.",
      valuationAsOf: "2026-11-06",
    },
  };
  return { snapshot, bars };
}
