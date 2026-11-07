import { z } from "zod";
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (x) =>
      Number.isFinite(Date.parse(x)) &&
      new Date(x).toISOString().slice(0, 10) === x,
    "Invalid date",
  );
export const timestamp = z.string().datetime({ offset: true });
const number = z.number().finite();
export const market = z.enum(["USA", "CANADA", "INDIA"]);
export const identity = z.object({
  symbol: z.string().regex(/^[A-Z0-9.-]{1,30}$/),
  market,
  currency: z.enum(["USD", "CAD", "INR"]),
  name: z.string().min(1).max(160),
});
export const bar = z
  .object({
    date,
    open: number.positive(),
    high: number.positive(),
    low: number.positive(),
    close: number.positive(),
    volume: number.nonnegative(),
  })
  .refine(
    (r) =>
      r.low <= Math.min(r.open, r.close) && r.high >= Math.max(r.open, r.close),
    "Invalid OHLC bounds",
  );
// All statement monetary amounts are full currency units, never lakhs/crores/millions.
export const annual = z.object({
  periodEnd: date,
  filedAt: timestamp,
  revenue: number.positive(),
  netIncome: number,
  normalizedIncome: number,
  ocf: number,
  capex: number.nonnegative(),
  eps: number,
  shares: number.positive(),
  equity: number.positive(),
  ebit: number,
  ebitda: number,
  interest: number.nonnegative(),
  taxRate: number.min(0).max(0.6),
  investedCapital: number.positive(),
  debt: number.nonnegative(),
  cash: number.nonnegative(),
  source: z.string().url(),
});
export const review = z
  .object({
    reviewedAt: timestamp,
    reviewer: z.string().min(1).max(120),
    sources: z.array(z.string().url()).min(1),
    audit: z.enum(["PASS", "FAIL", "UNKNOWN"]),
    governance: z.enum(["PASS", "FAIL", "UNKNOWN"]),
    legal: z.enum(["PASS", "FAIL", "UNKNOWN"]),
    workingCapital: z.enum(["PASS", "FAIL", "UNKNOWN"]),
    catalyst: z.string().min(10).max(2000),
    catalystDate: date,
    thesisInvalidation: z.string().min(10).max(2000),
    notes: z.string().max(6000),
    conservativeValue: number.positive(),
    bearValue: number.positive(),
    bullValue: number.positive(),
    valuationBasis: z.string().min(30).max(6000),
    valuationAsOf: date,
    forwardEps: number.positive().optional(),
    forwardEpsPeriod: date.optional(),
    expectedGrowthPct: number.positive().max(100).optional(),
    growthBasis: z.string().min(20).optional(),
  })
  .refine(
    (r) =>
      r.bearValue <= r.conservativeValue && r.conservativeValue <= r.bullValue,
    "Scenario values must be ordered",
  )
  .refine(
    (r) => (r.forwardEps === undefined) === (r.forwardEpsPeriod === undefined),
    "Forward EPS requires period",
  )
  .refine(
    (r) =>
      (r.expectedGrowthPct === undefined) === (r.growthBasis === undefined),
    "Growth needs evidence",
  );
export const snapshot = identity
  .extend({
    sector: z.enum(["NONFINANCIAL", "BANK", "INSURANCE", "REIT"]),
    asOf: timestamp,
    source: z.string().url(),
    capitalization: z
      .object({
        shares: number.positive(),
        asOf: timestamp,
        source: z.string().url(),
      })
      .optional(),
    annual: z.array(annual).min(3).max(15),
    review: review.optional(),
  })
  .superRefine((s, ctx) => {
    const seen = new Set<string>();
    for (const a of s.annual) {
      if (seen.has(a.periodEnd))
        ctx.addIssue({ code: "custom", message: "Duplicate fiscal period" });
      seen.add(a.periodEnd);
      if (
        Date.parse(a.filedAt) > Date.parse(s.asOf) ||
        a.periodEnd > a.filedAt.slice(0, 10)
      )
        ctx.addIssue({ code: "custom", message: "Future filing/period" });
    }
    if (
      s.capitalization &&
      Date.parse(s.capitalization.asOf) > Date.parse(s.asOf)
    )
      ctx.addIssue({ code: "custom", message: "Future capitalization" });
    if (
      s.review &&
      (Date.parse(s.review.reviewedAt) > Date.parse(s.asOf) ||
        s.review.valuationAsOf > s.asOf.slice(0, 10))
    )
      ctx.addIssue({ code: "custom", message: "Future review" });
    if (
      (s.market === "USA" && s.currency !== "USD") ||
      (s.market === "CANADA" && s.currency !== "CAD") ||
      (s.market === "INDIA" && s.currency !== "INR")
    )
      ctx.addIssue({
        code: "custom",
        message: "Currency does not match supported listing",
      });
  });
export type Snapshot = z.infer<typeof snapshot>;
export type Bar = z.infer<typeof bar>;
export type Identity = z.infer<typeof identity>;
export type ScanResult = {
  id: string;
  identity: Identity;
  at: string;
  status: "QUALIFIED" | "RESEARCH" | "REJECT" | "UNAVAILABLE";
  reasons: string[];
  price?: number;
  priceDate?: string;
  label: "CLOSE" | "UNAVAILABLE";
  metrics?: Record<string, number | null>;
  technical?: ReturnType<typeof import("./indicators.js").indicators>;
  review?: z.infer<typeof review>;
  source?: string;
  researchOnly: true;
};
