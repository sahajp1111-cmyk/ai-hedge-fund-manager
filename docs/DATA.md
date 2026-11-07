# Financial and price data contract

Import through Research queue → Import research dataset, or POST `/api/import` with `research:write` scope. Maximum body size 2 MB. Shape: `{ "snapshot": {...}, "bars": [...] }`. See `shared/schema.ts` for the executable contract. Schemas reject missing values, invalid dates, inconsistent currencies, future filing dates, duplicates and malformed OHLC.

## Snapshot

- `symbol`, `name`, `market` (`USA`, `CANADA`, `INDIA`), `currency` (`USD`, `CAD`, `INR`). Identity must match a configured universe entry. Only these listing currencies are supported; quote subunits, ADR ratios and dual listings require explicit normalization upstream.
- `sector`: `NONFINANCIAL`, `BANK`, `INSURANCE`, `REIT`. Industrial qualification applies only to NONFINANCIAL.
- `asOf`: ISO timestamp at which these inputs were available. Refresh at least every seven days; never simply relabel stale evidence.
- `source`: primary-source or dataset URL, without credentials.
- `capitalization`: `{shares, asOf, source}` for a current listing share count. Required for qualification; older than 120 days needs reassessment. This is distinct from annual EPS weighted-average shares.
- `annual`: at least three contiguous fiscal years. Each row has `periodEnd`, `filedAt`, `source`, `revenue`, `netIncome`, `normalizedIncome`, `ocf`, `capex`, `eps`, `shares`, `equity`, `ebit`, `ebitda`, `interest`, `taxRate`, `investedCapital`, `debt`, `cash`.

All money and share counts use FULL units: ₹1 crore = 10,000,000 INR, not the number 1. `capex` and `interest` are positive outflows. `taxRate` is a fraction. Include leases in debt consistently and explain lease treatment. EBIT, tax and average invested capital must use a consistent operating definition. Calculate EPS on an appropriate weighted-average diluted share count, including corporate-action adjustments. Keep normalized profit adjustments reconciled to reported profit in review notes.

Annual ratios are not labeled TTM. A year-end share count can only approximate weighted-average EPS: the provider adapter uses this approximation provisionally and requires analyst verification. Cash includes provider cash/short-term investments; restricted cash and non-operating adjustments require review. Average invested capital is the mean of the two latest annual values.

## Analyst review

Optional `review` fields: `reviewedAt`, `reviewer`, `sources` (original URLs), `audit`, `governance`, `legal`, `workingCapital` (each PASS / FAIL / UNKNOWN), `catalyst`, `catalystDate`, `thesisInvalidation`, `notes`, `bearValue`, `conservativeValue`, `bullValue`, `valuationBasis`, `valuationAsOf`.

A review is REQUIRED for qualification. PASS means the reviewer actually inspected the relevant evidence, not merely that no problem appeared in a vendor ratio. Explain earnings normalizations, auditor opinion, contingent legal/tax exposures, related parties, pledges, working-capital trends, capex commitments, current share count, own-history/peer valuation, scenario assumptions and source dates in `notes` and `valuationBasis`.

Forward fields are optional: `forwardEps` with `forwardEpsPeriod`, `expectedGrowthPct` with `growthBasis`. PEG is unavailable unless both forward EPS and supported positive normalized growth exist. Historical CAGR is never silently substituted for forward PEG.

## Prices

At least 200 increasing, unique dates with `date`, `open`, `high`, `low`, `close`, `volume`. Input OHLC must share the same corporate-action adjustment basis. Do not mix raw high/low with adjusted close. Provider historical bars are adjusted consistently by adjusted-close/raw-close ratio. Volume remains provider volume; latest-price turnover is an approximation. Prices older than five calendar days cannot qualify. Exchange calendars are not implemented; prolonged holidays may therefore remain unqualified until new prices arrive.

## Holdings JSON

Upload an array, for example:

```json
[
  {
    "symbol": "MWA",
    "market": "USA",
    "currency": "USD",
    "shares": 1,
    "bookCost": 25
  }
]
```

This is an illustrative FORMAT, not an assumed user position. `bookCost` is total position cost, not per-share cost. Upload replaces the manual list. Duplicate listing positions are rejected. Currency conversion, commissions, dividend income and tax lots are not modeled.

## Provider references

- https://eodhd.com/financial-apis/api-for-historical-data-and-volumes
- https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds
- https://eodhd.com/help/methodology
- https://upstox.com/developer/api-documentation/get-full-market-quote/
- https://twelvedata.com/docs

Entitlements and exact listing mappings must be verified with the provider. Failed identity/currency/required-field checks return UNAVAILABLE. No credentials are included in persisted source URLs.
