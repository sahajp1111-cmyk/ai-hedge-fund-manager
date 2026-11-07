import {
  mkdir,
  readFile,
  writeFile,
  rename,
  open,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { Snapshot, ScanResult, Bar } from "../shared/schema.js";
import type { Job, Alert } from "../shared/operations.js";
export type { Job, Alert } from "../shared/operations.js";
export type State = {
  version: 1;
  holdings?: {
    symbol: string;
    market: string;
    currency: string;
    shares: number;
    bookCost: number;
  }[];
  evidence?: {
    id: string;
    key: string;
    kind: string;
    date: string;
    url: string;
    facts: string;
    interpretation: string;
    createdAt: string;
  }[];
  cursor: number;
  jobs: Job[];
  alerts: Alert[];
  results: Record<string, ScanResult>;
  snapshots: Record<string, Snapshot>;
  history: Record<string, { fetchedAt: string; bars: Bar[] }>;
  lastScan?: { at: string; coverage: string[]; errors: number };
  lastWorkerError?: string;
};
export const emptyState = (): State => ({
  version: 1,
  cursor: 0,
  jobs: [],
  alerts: [],
  results: {},
  snapshots: {},
  history: {},
});
export class Store {
  private state: State = emptyState();
  private chain: Promise<unknown> = Promise.resolve();
  private lock?: Awaited<ReturnType<typeof open>>;
  constructor(readonly directory: string) {}
  async init() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    try {
      this.lock = await open(
        path.join(this.directory, "writer.lock"),
        "wx",
        0o600,
      );
      await this.lock.writeFile(String(process.pid));
    } catch {
      throw new Error(
        "Data directory already locked. Stop the other process; remove writer.lock only after confirming it stopped.",
      );
    }
    try {
      const parsed = JSON.parse(
        await readFile(path.join(this.directory, "state.json"), "utf8"),
      );
      if (
        parsed.version !== 1 ||
        !Array.isArray(parsed.jobs) ||
        !Array.isArray(parsed.alerts) ||
        !Number.isInteger(parsed.cursor) ||
        parsed.cursor < 0 ||
        !parsed.results ||
        !parsed.snapshots ||
        !parsed.history
      )
        throw new Error("Invalid or unsupported stored state");
      this.state = parsed;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
        await this.close();
        throw e;
      }
    }
    await this.mutate((s) => {
      for (const j of s.jobs)
        if (j.status === "running") {
          j.status = "queued";
          j.updatedAt = new Date().toISOString();
        }
    });
  }
  read(): State {
    return structuredClone(this.state);
  }
  async mutate<T>(fn: (s: State) => T): Promise<T> {
    const next = this.chain.then(async () => {
      const draft = structuredClone(this.state);
      const value = fn(draft);
      const tmp = path.join(this.directory, `state-${crypto.randomUUID()}.tmp`);
      try {
        await writeFile(tmp, JSON.stringify(draft), { mode: 0o600 });
        await rename(tmp, path.join(this.directory, "state.json"));
        this.state = draft;
        return structuredClone(value);
      } finally {
        await unlink(tmp).catch(() => {});
      }
    });
    this.chain = next.catch(() => {});
    return next;
  }
  async close() {
    await this.chain;
    if (this.lock) {
      await this.lock.close();
      this.lock = undefined;
      await unlink(path.join(this.directory, "writer.lock"));
    }
  }
}
