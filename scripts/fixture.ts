import { writeFile } from "node:fs/promises";
import { fixture } from "../tests/fixtures.js";
const out = process.argv[2];
if (!out) throw new Error("Supply output path; synthetic test fixture only");
await writeFile(out, JSON.stringify(fixture(), null, 2));
console.log("Synthetic test dataset written. Do not treat as market data.");
