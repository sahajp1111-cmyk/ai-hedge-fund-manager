import crypto from "node:crypto";
import type { Store, Job } from "./store.js";
import { universe, type Security } from "./universe.js";
import { evaluate } from "../shared/evaluate.js";
import type { ScanResult, Snapshot, Bar } from "../shared/schema.js";
import { queueAlert, deliverAlerts } from "./notifications.js";
export type DataSource = {
  history(s: Security): Promise<Bar[]>;
  fundamentals(s: Security): Promise<Snapshot>;
};
export class Worker {
  private busy = false;
  private timer?: ReturnType<typeof setInterval>;
  private stopping = false;
  constructor(
    private store: Store,
    private source: DataSource,
    private options: {
      batch: number;
      webhook?: string;
      secret?: string;
      clock?: () => Date;
      telegram?: { token: string; chatId: string };
    } = { batch: 3 },
  ) {}
  async enqueue(key: string, subject: string): Promise<Job> {
    if (!universe.some((s) => `${s.market}:${s.symbol}` === key))
      throw new Error("Security is not in the configured universe");
    return this.store.mutate((s) => {
      const existing = s.jobs.find(
        (j) =>
          j.key === key && (j.status === "queued" || j.status === "running"),
      );
      if (existing) return existing;
      if (s.jobs.filter((j) => j.status === "queued").length >= 50)
        throw new Error("Research queue full");
      const now = new Date().toISOString();
      const job: Job = {
        id: crypto.randomUUID(),
        key,
        subject,
        status: "queued",
        createdAt: now,
        updatedAt: now,
      };
      s.jobs.push(job);
      return job;
    });
  }
  private async research(security: Security) {
    const now = this.options.clock?.() ?? new Date(),
      key = `${security.market}:${security.symbol}`;
    const state = this.store.read();
    let snap = state.snapshots[key],
      history = state.history[key];
    if (!snap || now.getTime() - Date.parse(snap.asOf) > 86400000 * 7) {
      const fresh = await this.source.fundamentals(security);
      // A review is not copied to changed financial data without explicit re-review.
      snap = fresh;
      await this.store.mutate((s) => {
        s.snapshots[key] = fresh;
      });
    }
    if (
      !history ||
      now.getTime() - Date.parse(history.fetchedAt) > 6 * 3600000
    ) {
      const bars = await this.source.history(security);
      history = { fetchedAt: now.toISOString(), bars };
      await this.store.mutate((s) => {
        s.history[key] = history!;
      });
    }
    const result = evaluate(snap, history.bars, now);
    await this.store.mutate((s) => {
      s.results[key] = result;
    });
    await queueAlert(this.store, result);
    return result;
  }
  async tick() {
    if (this.busy || this.stopping) return;
    this.busy = true;
    try {
      const coverage: string[] = [];
      let errors = 0;
      const pending = this.store
        .read()
        .jobs.filter((j) => j.status === "queued")
        .slice(0, this.options.batch);
      const state = this.store.read(),
        rotated = Array.from(
          { length: Math.min(this.options.batch, universe.length) },
          (_, i) => universe[(state.cursor + i) % universe.length],
        );
      const keys = [
        ...new Set([
          ...pending.map((j) => j.key),
          ...rotated.map((s) => `${s.market}:${s.symbol}`),
        ]),
      ];
      for (const key of keys) {
        if (this.stopping) break;
        const security = universe.find(
          (s) => `${s.market}:${s.symbol}` === key,
        )!;
        coverage.push(key);
        await this.store.mutate((s) => {
          for (const j of s.jobs)
            if (j.key === key && j.status === "queued") {
              j.status = "running";
              j.updatedAt = new Date().toISOString();
            }
        });
        try {
          const result = await this.research(security);
          await this.store.mutate((s) => {
            for (const j of s.jobs)
              if (j.key === key && j.status === "running") {
                j.status = "completed";
                j.result = result;
                j.updatedAt = new Date().toISOString();
              }
          });
        } catch {
          errors++;
          const result: ScanResult = {
            id: key,
            identity: security,
            at: new Date().toISOString(),
            status: "UNAVAILABLE",
            reasons: [
              "Data unavailable or invalid. Check provider entitlement, symbol mapping, dates and imported evidence.",
            ],
            label: "UNAVAILABLE",
            researchOnly: true,
          };
          await this.store.mutate((s) => {
            s.results[key] = result;
            for (const j of s.jobs)
              if (j.key === key && j.status === "running") {
                j.status = "failed";
                j.error = result.reasons[0];
                j.updatedAt = result.at;
              }
          });
        }
      }
      await this.store.mutate((s) => {
        s.cursor = (s.cursor + rotated.length) % universe.length;
        s.lastScan = { at: new Date().toISOString(), coverage, errors };
        s.lastWorkerError = undefined;
        s.jobs = s.jobs.filter(
          (j) => Date.now() - Date.parse(j.createdAt) < 30 * 86400000,
        );
      });
      await deliverAlerts(
        this.store,
        this.options.webhook,
        this.options.secret,
        fetch,
        this.options.telegram,
      );
    } finally {
      this.busy = false;
    }
  }
  start(minutes: number) {
    const run = () =>
      void this.tick().catch(() =>
        this.store.mutate((s) => {
          s.lastWorkerError =
            "Worker failed; inspect storage and configuration";
        }),
      );
    this.timer = setInterval(run, minutes * 60000);
    run();
  }
  async stop() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    while (this.busy) await new Promise((r) => setTimeout(r, 20));
  }
}
