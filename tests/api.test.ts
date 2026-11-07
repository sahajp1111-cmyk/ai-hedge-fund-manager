import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Store } from "../server/store.js";
import { Worker } from "../server/worker.js";
import { createApp } from "../server/app.js";
import { fixture } from "./fixtures.js";
test("API end to end: valid import, durable queued research, source ledger, portfolio, rejected bad data and foreign origins", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "api-"));
  const store = new Store(dir);
  await store.init();
  const f = fixture();
  const worker = new Worker(
    store,
    {
      async history() {
        return f.bars;
      },
      async fundamentals() {
        return f.snapshot;
      },
    },
    { batch: 1, clock: () => new Date("2026-11-07T00:00:00Z") },
  );
  const server = createApp(store, worker).listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", () => r()));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const post = (p: string, b: unknown, headers = {}) =>
    fetch(base + p, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(b),
    });
  try {
    assert.equal((await fetch(base + "/api/health")).status, 200);
    assert.equal(
      (
        await post(
          "/api/research",
          { key: "USA:MWA" },
          { Origin: "https://evil.example" },
        )
      ).status,
      403,
    );
    assert.equal(
      (await post("/api/import", { snapshot: {}, bars: [] })).status,
      400,
    );
    assert.equal((await post("/api/import", f)).status, 202);
    await worker.tick();
    const end = Date.now() + 2000;
    while (
      ["queued", "running"].includes(store.read().jobs[0].status) &&
      Date.now() < end
    )
      await new Promise((r) => setTimeout(r, 10));
    assert.equal(store.read().jobs[0].status, "completed");
    const results = await (await fetch(base + "/api/scans")).json();
    assert.ok(results.some((x: any) => x.id === "USA:MWA"));
    assert.equal(
      (
        await post("/api/evidence", {
          key: "USA:MWA",
          kind: "FILING",
          date: "2026-11-06",
          url: "https://example.test/filing",
          facts: "Synthetic API test facts, no actual investment evidence.",
          interpretation: "Test only",
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await post("/api/portfolio", [
          {
            symbol: "MWA",
            market: "USA",
            currency: "CAD",
            shares: 1,
            bookCost: 1,
          },
        ])
      ).status,
      400,
    );
    assert.equal(
      (
        await post("/api/portfolio", [
          {
            symbol: "MWA",
            market: "USA",
            currency: "USD",
            shares: 1,
            bookCost: 1,
          },
        ])
      ).status,
      200,
    );
    assert.equal(
      (await (await fetch(base + "/api/portfolio")).json()).holdings.length,
      1,
    );
  } finally {
    await worker.stop();
    await new Promise<void>((r, e) => server.close((x) => (x ? e(x) : r())));
    await store.close();
    await rm(dir, { recursive: true, force: true });
  }
});
