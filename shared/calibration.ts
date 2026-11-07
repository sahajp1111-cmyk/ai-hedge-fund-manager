import { z } from "zod";
import { snapshot, bar, date, timestamp } from "./schema.js";
import { evaluate } from "./evaluate.js";
export const observation = z.object({
  decisionDate: date,
  universeKnownAt: timestamp,
  snapshot,
  history: z.array(bar).min(200),
  future: z.array(bar).min(64),
  benchmark: z.array(bar).min(64),
});
export type Observation = z.infer<typeof observation>;
export function walkForward(input: Observation[], costBps = 20) {
  if (!Number.isFinite(costBps) || costBps < 0 || costBps > 1000)
    throw new Error("Invalid cost");
  const observations = input
    .map((x) => observation.parse(x))
    .sort((a, b) => a.decisionDate.localeCompare(b.decisionDate));
  const groups = new Map<
    string,
    { selected: number[]; all: number[]; benchmark: number[] }
  >();
  const seen = new Set<string>();
  let previousEnd = "";
  const dates = [...new Set(observations.map((o) => o.decisionDate))];
  for (const decision of dates) {
    const bucket = observations.filter((o) => o.decisionDate === decision);
    if (decision <= previousEnd)
      throw new Error(
        "Overlapping evaluation cohorts: require 63-session embargo",
      );
    let exitDate = "";
    const group = {
      selected: [] as number[],
      all: [] as number[],
      benchmark: [] as number[],
    };
    for (const o of bucket) {
      const key = `${o.snapshot.market}:${o.snapshot.symbol}:${decision}`;
      if (seen.has(key)) throw new Error("Duplicate security observation");
      seen.add(key);
      const at = decision + "T23:59:59Z";
      if (
        Date.parse(o.snapshot.asOf) > Date.parse(at) ||
        Date.parse(o.universeKnownAt) > Date.parse(at) ||
        o.snapshot.annual.some((a) => Date.parse(a.filedAt) > Date.parse(at)) ||
        (o.snapshot.review &&
          Date.parse(o.snapshot.review.reviewedAt) > Date.parse(at))
      )
        throw new Error("Point-in-time leakage");
      if (
        o.history.some(
          (b, i) =>
            b.date > decision || (i > 0 && b.date <= o.history[i - 1].date),
        ) ||
        o.history.at(-1)!.date !== decision
      )
        throw new Error("History cutoff/date order invalid");
      for (const series of [o.future, o.benchmark])
        if (
          series[0].date !== decision ||
          series.some((b, i) => i > 0 && b.date <= series[i - 1].date)
        )
          throw new Error("Invalid outcome series");
      const end = o.future[63];
      if (
        end.date !== o.benchmark[63].date ||
        o.future[0].close !== o.history.at(-1)!.close
      )
        throw new Error("Outcome/benchmark dates or entry price mismatch");
      if (exitDate && end.date !== exitDate)
        throw new Error("Cohort exits must match");
      exitDate = end.date;
      const ret = end.close / o.future[0].close - 1 - costBps / 10000,
        bm = o.benchmark[63].close / o.benchmark[0].close - 1 - costBps / 10000;
      group.all.push(ret);
      group.benchmark.push(bm);
      if (evaluate(o.snapshot, o.history, new Date(at)).status === "QUALIFIED")
        group.selected.push(ret);
    }
    groups.set(decision, group);
    previousEnd = exitDate;
  }
  const avg = (a: number[]) =>
    a.length ? a.reduce((a, b) => a + b, 0) / a.length : 0;
  let equity = 1,
    peak = 1,
    maxDrawdown = 0;
  const folds = [...groups].map(([date, g]) => {
    const net = avg(g.selected);
    equity *= 1 + net;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, equity / peak - 1);
    return {
      date,
      selected: g.selected.length,
      universe: g.all.length,
      netReturn: net,
      equalWeightUniverse: avg(g.all),
      benchmark: avg(g.benchmark),
      excessVsUniverse: net - avg(g.all),
      excessVsBenchmark: net - avg(g.benchmark),
    };
  });
  const trades = [...groups.values()].flatMap((g) => g.selected);
  return {
    researchOnly: true,
    protocol:
      "Fixed gates, chronological non-overlapping 63-session cohorts; no optimization on evaluation outcomes",
    costBps,
    folds,
    observations: observations.length,
    selected: trades.length,
    coverage: observations.length ? trades.length / observations.length : 0,
    hitRate: trades.length
      ? trades.filter((x) => x > 0).length / trades.length
      : null,
    meanTradeReturn: trades.length ? avg(trades) : null,
    cumulativeReturn: equity - 1,
    maxDrawdown,
    minimumEvidenceMet: folds.length >= 3 && trades.length >= 100,
    limitations: [
      "No investability approval is issued by this report",
      "Requires archived point-in-time statements, historical universe including delistings, and consistently adjusted price vintages",
      "Equal allocation each cohort; unselected cohorts held in zero-return cash; taxes, FX and market impact excluded",
      "Research ranking validation is separate from personalized investment advice",
    ],
  };
}
