# Calibration and acceptance

The gate evaluator is a research filter. Capital Radar scores have not been calibrated and no return probability or approved buy signal is claimed.

## Historical schema

Run `npm run calibrate -- /private/observations.json /private/report.json`. Input is an array of records with:

- `decisionDate`: ISO session date.
- `universeKnownAt`: timestamp proving historical universe membership was known.
- `snapshot`: frozen financial/review/capitalization schema from DATA.md; its availability time must precede decision close.
- `history`: at least 200 consistently adjusted OHLCV observations ending at decisionDate; no later bars.
- `future`: outcome series starting at decision close, at least 64 observations.
- `benchmark`: matching-date benchmark series, at least 64 observations, same currency and adjustment conventions.

Include delisted securities, actual point-in-time universe membership, original filing availability, subsequent restatements as new vintages and corporate actions. Current vendor history is not sufficient evidence that historical values were available at the time. Store dataset provenance separately with immutable archive hashes and original source URLs. An input timestamp is necessary but cannot prove the supplied historical dataset is genuine.

## Protocol

Fixed qualification rules; no fitted weights. Chronological, non-overlapping 63-session cohorts. Reject duplicate observations, outcome price mismatch, future filings/reviews, future history, unknown historical membership, unsynchronized cohort exits and overlapping holdings. There is no tuning on evaluation outcomes. If thresholds are tuned later, use separate training/validation windows, purge overlapping labels, embargo at least the holding period, then lock parameters before the untouched test window.

Selected companies are equal weighted within each cohort. Compare with equal-weight full candidate universe and a same-currency benchmark on the same dates. Deduct 20 basis points per round trip by default. Report coverage, selected count, hit rate, net returns, excess return and cohort compounded drawdown. Unselected cohorts hold zero-return cash. FX, taxes and size-dependent impact are not modeled; the report discloses those limits. Drawdown is measured at cohort exits, not daily peak-to-trough drawdown.

Minimum research evidence: three non-overlapping cohorts and 100 selected observations. This threshold does NOT automatically approve a strategy. Require a reviewer to inspect survivorship, regime diversity, source quality, cost sensitivities and concentration; no report changes `researchOnly: true`.

## Engineering acceptance

- Persist an imported company and research job; complete it and retain results across restart.
- Real or source-verified input reaches displayed calculations; no static sample candidates on startup.
- Failed/stale/missing identity, financial, share-count, review, liquidity and technical checks cannot qualify.
- RSI/ATR use Wilder smoothing; MACD uses aligned SMA-seeded EMAs and a 9-period signal EMA.
- Original sources, filing dates, scenario basis, valuation date, catalyst and invalidation remain visible.
- Alert transitions deduplicate and failed delivery remains retryable.
- API mutation validation and foreign-origin protection pass; production refuses to start without auth/owner configuration.
- Full client/server build and tests pass on Node 22 and 24.

## Operational acceptance before live use

A deployed persistent service, valid entitlements, verified listing mappings, current original filings/reviews, tested backup restore, and a confirmed private notification destination are required. Until those exist, engineering functionality is testable but live investment monitoring is not operationally verified.
