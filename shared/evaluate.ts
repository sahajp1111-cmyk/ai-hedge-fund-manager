import { indicators } from "./indicators.js";
import type { Bar, Snapshot, ScanResult } from "./schema.js";
export function cagr(start: number, end: number, years: number) {
  return start > 0 && end > 0 && years > 0
    ? (Math.pow(end / start, 1 / years) - 1) * 100
    : null;
}
export function evaluate(
  s: Snapshot,
  bars: Bar[],
  now = new Date(),
): ScanResult {
  const result: ScanResult = {
    id: `${s.market}:${s.symbol}`,
    identity: {
      symbol: s.symbol,
      market: s.market,
      currency: s.currency,
      name: s.name,
    },
    at: now.toISOString(),
    status: "RESEARCH",
    reasons: [],
    label: "UNAVAILABLE",
    researchOnly: true,
    source: s.source,
    review: s.review,
  };
  const fail = (reason: string) => result.reasons.push(reason);
  if ((now.getTime() - Date.parse(s.asOf)) / 86400000 > 7)
    fail("Snapshot needs refresh (>7 days)");
  if (s.capitalization && Date.parse(s.capitalization.asOf) > now.getTime())
    fail("Future share count");
  if (s.review && Date.parse(s.review.reviewedAt) > now.getTime())
    fail("Future review");
  if (Date.parse(s.asOf) > now.getTime()) fail("Snapshot is from the future");
  if (s.sector !== "NONFINANCIAL") {
    fail(
      "Sector-specific bank/insurance/REIT model required; industrial gates are not applicable",
    );
    return result;
  }
  if (bars.length < 200) {
    fail("At least 200 dated daily bars required");
    return result;
  }
  if (
    bars.some(
      (b, i) =>
        b.date > now.toISOString().slice(0, 10) ||
        (i > 0 && b.date <= bars[i - 1].date),
    )
  ) {
    fail("Future, duplicate or unordered prices");
    return result;
  }
  const last = bars.at(-1)!;
  result.price = last.close;
  result.priceDate = last.date;
  result.label = "CLOSE";
  if ((now.getTime() - Date.parse(last.date)) / 86400000 > 5)
    fail("Closing price is stale (>5 calendar days)");
  const a = [...s.annual].sort((x, y) =>
      x.periodEnd.localeCompare(y.periodEnd),
    ),
    recent = a.slice(-3),
    latest = a.at(-1)!;
  if (a.some((x) => Date.parse(x.filedAt) > now.getTime()))
    fail("Statement unavailable at evaluation time");
  if ((now.getTime() - Date.parse(latest.periodEnd)) / 86400000 > 460)
    fail("Annual statements are stale");
  if (
    a.some(
      (x, i) =>
        i > 0 &&
        Math.abs(
          (Date.parse(x.periodEnd) - Date.parse(a[i - 1].periodEnd)) /
            86400000 -
            365.25,
        ) > 45,
    )
  )
    fail("Fiscal periods must be contiguous annual observations");
  const sum = (f: (x: typeof latest) => number) =>
    recent.reduce((n, x) => n + f(x), 0);
  const ni = sum((x) => x.normalizedIncome),
    ocf = sum((x) => x.ocf),
    fcf = sum((x) => x.ocf - x.capex);
  if (!s.capitalization) fail("Current source-linked share count missing");
  if (
    s.capitalization &&
    (now.getTime() - Date.parse(s.capitalization.asOf)) / 86400000 > 120
  )
    fail("Share count needs reassessment (>120 days)");
  const marketCap = last.close * (s.capitalization?.shares ?? latest.shares),
    netDebt = latest.debt - latest.cash;
  const roic =
    ((latest.ebit * (1 - latest.taxRate)) /
      ((latest.investedCapital + a.at(-2)!.investedCapital) / 2)) *
    100;
  const leverage = latest.ebitda > 0 ? netDebt / latest.ebitda : null;
  const interestCoverage =
    latest.interest > 0 ? latest.ebit / latest.interest : null;
  const dilution = latest.shares / a.at(-2)!.shares - 1;
  const years =
    (Date.parse(latest.periodEnd) - Date.parse(a[0].periodEnd)) /
    86400000 /
    365.25;
  result.metrics = {
    annualPe: latest.eps > 0 ? last.close / latest.eps : null,
    annualPeriodEnd: Number(latest.periodEnd.slice(0, 4)),
    forwardPe: s.review?.forwardEps ? last.close / s.review.forwardEps : null,
    peg:
      s.review?.forwardEps && s.review.expectedGrowthPct
        ? last.close / s.review.forwardEps / s.review.expectedGrowthPct
        : null,
    marketCap,
    priceBook: marketCap / latest.equity,
    evEbitda: latest.ebitda > 0 ? (marketCap + netDebt) / latest.ebitda : null,
    fcfYield: ((latest.ocf - latest.capex) / marketCap) * 100,
    roic,
    netDebtEbitda: leverage,
    interestCoverage,
    cashConversion: ni > 0 ? ocf / ni : null,
    aggregateFcf: fcf,
    dilutionPct: dilution * 100,
    cagrYears: years,
    revenueCagr: cagr(a[0].revenue, latest.revenue, years),
    epsCagr: cagr(a[0].eps, latest.eps, years),
    fcfPerShareCagr: cagr(
      (a[0].ocf - a[0].capex) / a[0].shares,
      (latest.ocf - latest.capex) / latest.shares,
      years,
    ),
    marginOfSafety: s.review
      ? 1 - last.close / s.review.conservativeValue
      : null,
    bearReturn: s.review ? s.review.bearValue / last.close - 1 : null,
    baseReturn: s.review ? s.review.conservativeValue / last.close - 1 : null,
    bullReturn: s.review ? s.review.bullValue / last.close - 1 : null,
  };
  for (const n of [3, 5, 10]) {
    const start = a.find(
      (x) =>
        Math.abs(
          (Date.parse(latest.periodEnd) - Date.parse(x.periodEnd)) /
            86400000 /
            365.25 -
            n,
        ) < 0.13,
    );
    for (const field of ["revenue", "eps", "fcfPerShare"] as const)
      result.metrics![`${field}Cagr${n}Y`] = start
        ? cagr(
            field === "fcfPerShare"
              ? (start.ocf - start.capex) / start.shares
              : start[field],
            field === "fcfPerShare"
              ? (latest.ocf - latest.capex) / latest.shares
              : latest[field],
            (Date.parse(latest.periodEnd) - Date.parse(start.periodEnd)) /
              86400000 /
              365.25,
          )
        : null;
  }
  if (
    recent.some((x) => x.normalizedIncome <= 0) ||
    ni <= 0 ||
    ocf <= 0 ||
    fcf <= 0
  )
    fail("Three-year normalized profit / aggregate cash flow gate failed");
  if (ni <= 0 || ocf / ni < 0.8)
    fail("Three-year OCF/normalized profit below 80%");
  if (roic < 15) fail("ROIC below 15%");
  if (leverage === null || leverage >= 2)
    fail("Net debt/EBITDA must be below 2x");
  if (latest.ebit <= 0 || (interestCoverage !== null && interestCoverage <= 5))
    fail("Interest coverage must exceed 5x");
  if (dilution > 0.03) fail("Annual share dilution exceeds 3%");
  if (
    (result.metrics.revenueCagr ?? -1) <= 0 ||
    (result.metrics.epsCagr ?? -1) <= 0
  )
    fail("Positive revenue and EPS growth required");
  result.technical = indicators(bars);
  const t = result.technical;
  if (
    last.close < t.sma200 ||
    t.sma50 < t.sma200 ||
    last.close < t.sma20 ||
    t.macd < t.macdSignal ||
    t.rsi < 40 ||
    t.rsi > 70
  )
    fail("Trend/momentum entry confirmation incomplete");
  const minTurnover = { USA: 250000, CANADA: 150000, INDIA: 10000000 }[
    s.market
  ];
  if (t.averageVolume20 * last.close < minTurnover)
    fail("Average daily turnover below market-specific minimum");
  const r = s.review;
  if (!r) fail("Source-linked analyst review and scenario valuation missing");
  else {
    if (
      (now.getTime() - Date.parse(r.reviewedAt)) / 86400000 > 90 ||
      (now.getTime() - Date.parse(r.valuationAsOf)) / 86400000 > 90
    )
      fail("Analyst review/valuation older than 90 days");
    if (r.catalystDate < now.toISOString().slice(0, 10))
      fail("Catalyst needs reassessment");
    for (const key of [
      "audit",
      "governance",
      "legal",
      "workingCapital",
    ] as const)
      if (r[key] !== "PASS") fail(`${key} review: ${r[key]}`);
    if (1 - last.close / r.conservativeValue < 0.2)
      fail("Less than 20% margin of safety");
  }
  if (result.reasons.length === 0) result.status = "QUALIFIED";
  else if (
    result.reasons.some((x) =>
      /gate failed|below 15|below 80|dilution exceeds|review: FAIL/.test(x),
    )
  )
    result.status = "REJECT";
  return result;
}
