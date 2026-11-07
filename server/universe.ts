import { readFileSync } from "node:fs";
import { z } from "zod";
import { identity } from "../shared/schema.js";
import type { Identity } from "../shared/schema.js";
export type Security = Identity & { providerSymbol: string };
const defaults: Security[] = [
  {
    symbol: "MWA",
    market: "USA",
    currency: "USD",
    name: "Mueller Water Products",
    providerSymbol: "MWA.US",
  },
  {
    symbol: "BMI",
    market: "USA",
    currency: "USD",
    name: "Badger Meter",
    providerSymbol: "BMI.US",
  },
  {
    symbol: "GRC",
    market: "USA",
    currency: "USD",
    name: "Gorman-Rupp",
    providerSymbol: "GRC.US",
  },
  {
    symbol: "MLI",
    market: "USA",
    currency: "USD",
    name: "Mueller Industries",
    providerSymbol: "MLI.US",
  },
  {
    symbol: "BDT",
    market: "CANADA",
    currency: "CAD",
    name: "Bird Construction",
    providerSymbol: "BDT.TO",
  },
  {
    symbol: "STN",
    market: "CANADA",
    currency: "CAD",
    name: "Stantec",
    providerSymbol: "STN.TO",
  },
  {
    symbol: "TFII",
    market: "CANADA",
    currency: "CAD",
    name: "TFI International",
    providerSymbol: "TFII.TO",
  },
  {
    symbol: "BYD",
    market: "CANADA",
    currency: "CAD",
    name: "Boyd Group Services",
    providerSymbol: "BYD.TO",
  },
  {
    symbol: "DHANUKA",
    market: "INDIA",
    currency: "INR",
    name: "Dhanuka Agritech",
    providerSymbol: "DHANUKA.NSE",
  },
  {
    symbol: "CASTROLIND",
    market: "INDIA",
    currency: "INR",
    name: "Castrol India",
    providerSymbol: "CASTROLIND.NSE",
  },
  {
    symbol: "CONTROLPR",
    market: "INDIA",
    currency: "INR",
    name: "Control Print",
    providerSymbol: "CONTROLPR.NSE",
  },
  {
    symbol: "20MICRONS",
    market: "INDIA",
    currency: "INR",
    name: "20 Microns",
    providerSymbol: "20MICRONS.NSE",
  },
];

const configured = process.env.UNIVERSE_FILE
  ? z
      .array(
        identity.extend({
          providerSymbol: z.string().regex(/^[A-Za-z0-9.-]{1,80}$/),
        }),
      )
      .min(1)
      .max(50)
      .parse(JSON.parse(readFileSync(process.env.UNIVERSE_FILE, "utf8")))
  : Array.from({ length: 4 }, (_, i) => [
      defaults[i],
      defaults[i + 4],
      defaults[i + 8],
    ]).flat();
if (
  new Set(configured.map((s) => `${s.market}:${s.symbol}`)).size !==
  configured.length
)
  throw new Error("Duplicate universe entries");
export const universe: Security[] = configured;
