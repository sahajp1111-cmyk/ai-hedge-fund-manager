import { test } from "node:test";
import assert from "node:assert/strict";
import { indicators, emaSeries } from "../shared/indicators.js";
import { evaluate, cagr } from "../shared/evaluate.js";
import { snapshot } from "../shared/schema.js";
import { fixture } from "./fixtures.js";
import { walkForward } from "../shared/calibration.js";
test("MACD signal uses full aligned price history with independently calculated EMA", () => {
  const { bars } = fixture();
  const c = bars.map((x) => x.close);
  function reference(x: number[], n: number) {
    let a = x.slice(0, n).reduce((a, b) => a + b) / n;
    const out = [a];
    for (const v of x.slice(n)) {
      a += (2 / (n + 1)) * (v - a);
      out.push(a);
    }
    return out;
  }
  const f = reference(c, 12),
    s = reference(c, 26),
    m = s.map((x, i) => f[i + 14] - x);
  const signal = reference(m, 9).at(-1)!;
  assert.ok(Math.abs(indicators(bars).macdSignal - signal) < 1e-10);
  assert.ok(Math.abs(indicators(bars).macd - m.at(-1)!) < 1e-10);
  assert.equal(emaSeries([1, 2, 3, 4], 3)[2], 2);
});
test("Wilder RSI flat=50, rising=100 and invalid OHLC rejects", () => {
  const { bars } = fixture();
  const flat = bars.map((x) => ({
    ...x,
    open: 100,
    high: 101,
    low: 99,
    close: 100,
  }));
  assert.equal(indicators(flat).rsi, 50);
  assert.equal(
    indicators(
      flat.map((x, i) => ({
        ...x,
        open: 100 + i,
        high: 101 + i,
        low: 99 + i,
        close: 100 + i,
      })),
    ).rsi,
    100,
  );
  assert.throws(() =>
    indicators([{ ...bars[0], close: NaN }, ...bars.slice(1)]),
  );
});
test("Missing legal review, stale price, future data and leverage cannot qualify", () => {
  const { snapshot: s, bars } = fixture();
  const now = new Date("2026-11-07T00:00:00Z");
  const r = evaluate(s, bars, now);
  assert.ok(r.metrics);
  s.review!.legal = "UNKNOWN";
  assert.notEqual(evaluate(s, bars, now).status, "QUALIFIED");
  assert.ok(
    evaluate(s, bars, new Date("2026-12-01")).reasons.some((x) =>
      x.includes("stale"),
    ),
  );
  bars.at(-1)!.date = "2027-01-01";
  assert.ok(evaluate(s, bars, now).reasons.some((x) => x.includes("Future")));
  assert.equal(cagr(100, 121, 2), 10.000000000000009);
  assert.equal(cagr(-1, 2, 3), null);
});
test("No look-ahead filings or mismatched currency accepted at ingestion", () => {
  const f = fixture();
  f.snapshot.annual[0].filedAt = "2028-01-01T00:00:00Z";
  assert.equal(snapshot.safeParse(f.snapshot).success, false);
  f.snapshot.currency = "CAD";
  assert.equal(snapshot.safeParse(f.snapshot).success, false);
});
test("Walk forward rejects leaked snapshot and overlapping cohorts", () => {
  const f = fixture();
  const future = Array.from({ length: 64 }, (_, i) => ({
    ...f.bars.at(-1)!,
    date: new Date(Date.parse("2026-11-06") + i * 86400000)
      .toISOString()
      .slice(0, 10),
  }));
  const o = {
    decisionDate: "2026-11-06",
    universeKnownAt: "2020-01-01T00:00:00Z",
    snapshot: f.snapshot,
    history: f.bars,
    future,
    benchmark: future,
  };
  assert.equal(walkForward([o]).folds.length, 1);
  assert.throws(
    () => walkForward([o, { ...o, decisionDate: "2026-11-07" }]),
    /Overlapping/,
  );
  assert.throws(
    () => walkForward([{ ...o, universeKnownAt: "2027-01-01T00:00:00Z" }]),
    /leakage/,
  );
});

test("A fully reviewed candidate qualifies; each material safety gate independently blocks it", () => {
  const f = fixture();
  f.bars = f.bars.map((b, i) => {
    const c = 60 + i * 0.12 + Math.sin((i + 13) / 3) * 2;
    return { ...b, open: c - 0.1, high: c + 1, low: c - 1, close: c };
  });
  const now = new Date("2026-11-07");
  assert.equal(evaluate(f.snapshot, f.bars, now).status, "QUALIFIED");
  const cases = [
    (s: typeof f.snapshot) => {
      s.review = undefined;
    },
    (s: typeof f.snapshot) => {
      s.review!.conservativeValue = 95;
    },
    (s: typeof f.snapshot) => {
      s.review!.audit = "FAIL";
    },
    (s: typeof f.snapshot) => {
      s.review!.workingCapital = "UNKNOWN";
    },
    (s: typeof f.snapshot) => {
      s.annual.at(-1)!.debt = 1000;
    },
    (s: typeof f.snapshot) => {
      s.annual.at(-1)!.interest = 100;
    },
    (s: typeof f.snapshot) => {
      for (const a of s.annual) a.ocf = 10;
    },
    (s: typeof f.snapshot) => {
      s.annual.at(-1)!.shares = 150;
    },
    (s: typeof f.snapshot) => {
      s.capitalization = undefined;
    },
  ];
  for (const mutate of cases) {
    const s = structuredClone(f.snapshot);
    mutate(s);
    assert.notEqual(evaluate(s, f.bars, now).status, "QUALIFIED");
  }
  const r = evaluate(f.snapshot, f.bars, now);
  assert.equal(r.metrics!.revenueCagr3Y, null);
  assert.equal(r.metrics!.peg, null);
});
