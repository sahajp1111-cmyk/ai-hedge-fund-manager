import { readFile, writeFile } from "node:fs/promises";
import { walkForward, observation } from "../shared/calibration.js";
import { z } from "zod";
const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw new Error("Usage: npm run calibrate -- observations.json report.json");
const data = z
  .array(observation)
  .parse(JSON.parse(await readFile(input, "utf8")));
const report = walkForward(data);
await writeFile(output, JSON.stringify(report, null, 2));
console.log(
  `Evaluated ${report.observations} observations; research-only report written.`,
);
