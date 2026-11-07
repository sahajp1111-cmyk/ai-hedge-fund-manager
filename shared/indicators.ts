export type OHLCV = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
const clamp = (x: number) => Math.max(0, Math.min(100, x));
export function emaSeries(x: number[], period: number): number[] {
  const out = Array(x.length).fill(NaN);
  if (x.length < period) return out;
  out[period - 1] = mean(x.slice(0, period));
  const k = 2 / (period + 1);
  for (let i = period; i < x.length; i++)
    out[i] = x[i] * k + out[i - 1] * (1 - k);
  return out;
}
export function indicators(rows: OHLCV[]) {
  if (rows.length < 200) throw new Error("Need >=200 daily bars");
  for (const r of rows)
    if (
      ![r.open, r.high, r.low, r.close, r.volume].every(Number.isFinite) ||
      Math.min(r.open, r.high, r.low, r.close) <= 0 ||
      r.volume < 0 ||
      r.low > Math.min(r.open, r.close) ||
      r.high < Math.max(r.open, r.close)
    )
      throw new Error("Invalid OHLCV");
  const c = rows.map((r) => r.close),
    v = rows.map((r) => r.volume);
  const sma = (n: number) => mean(c.slice(-n));
  const changes = c.slice(1).map((x, i) => x - c[i]);
  let gain = mean(changes.slice(0, 14).map((x) => Math.max(0, x))),
    loss = mean(changes.slice(0, 14).map((x) => Math.max(0, -x)));
  for (const x of changes.slice(14)) {
    gain = (gain * 13 + Math.max(0, x)) / 14;
    loss = (loss * 13 + Math.max(0, -x)) / 14;
  }
  const rsi =
    gain === 0 && loss === 0
      ? 50
      : loss === 0
        ? 100
        : 100 - 100 / (1 + gain / loss);
  const fast = emaSeries(c, 12),
    slow = emaSeries(c, 26),
    macds = c.map((_, i) => fast[i] - slow[i]).slice(25);
  const signal = emaSeries(macds, 9).at(-1)!;
  const macd = macds.at(-1)!;
  const tr = rows
    .slice(1)
    .map((r, i) =>
      Math.max(
        r.high - r.low,
        Math.abs(r.high - rows[i].close),
        Math.abs(r.low - rows[i].close),
      ),
    );
  let atr = mean(tr.slice(0, 14));
  for (const x of tr.slice(14)) atr = (atr * 13 + x) / 14;
  const s20 = Math.sqrt(mean(c.slice(-20).map((x) => (x - sma(20)) ** 2)));
  const z20 = s20 ? (c.at(-1)! - sma(20)) / s20 : 0;
  const avgVolume = mean(v.slice(-21, -1));
  const relativeVolume = avgVolume ? v.at(-1)! / avgVolume : 0;
  const trend =
    (c.at(-1)! > sma(50) ? 15 : 0) +
    (c.at(-1)! > sma(200) ? 20 : 0) +
    (sma(50) > sma(200) ? 15 : 0);
  const momentum = clamp(
    50 + (rsi - 50) * 0.7 + ((macd - signal) / (atr || 1)) * 20,
  );
  return {
    rsi,
    macd,
    macdSignal: signal,
    atr,
    sma20: sma(20),
    sma50: sma(50),
    sma200: sma(200),
    z20,
    relativeVolume,
    averageVolume20: avgVolume,
    support20: Math.min(...rows.slice(-20).map((r) => r.low)),
    resistance20: Math.max(...rows.slice(-20).map((r) => r.high)),
    technicalScore: clamp(
      trend + momentum * 0.5 + clamp(relativeVolume * 35) * 0.25,
    ),
  };
}
export type FundamentalInput = {
  roic: number;
  fcfMargin: number;
  netDebtToEbitda: number;
  revenueCagr: number;
  epsCagr: number;
  fcfYield: number;
};
export function fundamentalScore(x: FundamentalInput) {
  if (!Object.values(x).every(Number.isFinite))
    throw new Error("Invalid fundamentals");
  const quality = clamp(
      50 + x.roic * 1.5 + x.fcfMargin * 0.7 - x.netDebtToEbitda * 8,
    ),
    growth = clamp(50 + x.revenueCagr + x.epsCagr),
    value = clamp(50 + x.fcfYield * 3);
  return {
    quality,
    growth,
    value,
    score: 0.5 * quality + 0.25 * growth + 0.25 * value,
  };
}
