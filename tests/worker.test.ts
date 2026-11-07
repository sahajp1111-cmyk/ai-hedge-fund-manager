import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Store } from "../server/store.js";
import { Worker } from "../server/worker.js";
import { queueAlert, deliverAlerts } from "../server/notifications.js";
import { fixture } from "./fixtures.js";
import { evaluate } from "../shared/evaluate.js";
test("Persistent queue survives restart, excludes concurrent writer, completes with data; missing provider fails closed", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "radar-"));
  let s = new Store(dir);
  try {
    await s.init();
    await assert.rejects(new Store(dir).init(), /locked/);
    const f = fixture();
    const source = {
      async history() {
        return f.bars;
      },
      async fundamentals() {
        return f.snapshot;
      },
    };
    let w = new Worker(s, source, {
      batch: 1,
      clock: () => new Date("2026-11-07"),
    });
    const j = await w.enqueue("USA:MWA", "test");
    assert.equal((await w.enqueue("USA:MWA", "test")).id, j.id);
    await s.close();
    s = new Store(dir);
    await s.init();
    w = new Worker(s, source, {
      batch: 1,
      clock: () => new Date("2026-11-07"),
    });
    await w.tick();
    assert.equal(s.read().jobs[0].status, "completed");
    assert.ok(s.read().results["USA:MWA"].metrics);
    const bad = new Worker(
      s,
      {
        async history() {
          throw Error("secret");
        },
        async fundamentals() {
          throw Error("secret");
        },
      },
      { batch: 1 },
    );
    await bad.enqueue("USA:BMI", "test");
    await bad.tick();
    assert.equal(s.read().results["USA:BMI"].status, "UNAVAILABLE");
    assert.ok(!JSON.stringify(s.read()).includes("secret"));
  } finally {
    await s.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("Alert outbox deduplicates, retains failed delivery, retries with idempotency key", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "alerts-"));
  const s = new Store(dir);
  try {
    await s.init();
    const f = fixture();
    const r = evaluate(f.snapshot, f.bars, new Date("2026-11-07"));
    r.status = "QUALIFIED";
    await queueAlert(s, r);
    await queueAlert(s, r);
    assert.equal(s.read().alerts.length, 1);
    await deliverAlerts(s);
    assert.equal(s.read().alerts[0].status, "pending");
    await deliverAlerts(
      s,
      "https://example.test/hook",
      undefined,
      async () => new Response("", { status: 500 }),
    );
    assert.equal(s.read().alerts[0].status, "failed");
    await s.mutate((state) => {
      state.alerts[0].nextAttemptAt = undefined;
    });
    let key = "";
    await deliverAlerts(
      s,
      "https://example.test/hook",
      "test",
      async (_url, init) => {
        key = (init?.headers as Record<string, string>)["Idempotency-Key"];
        return new Response("ok");
      },
    );
    assert.equal(key, s.read().alerts[0].id);
    assert.equal(s.read().alerts[0].status, "sent");
    await queueAlert(s, { ...r, status: "REJECT" });
    assert.equal(s.read().alerts.length, 2);
  } finally {
    await s.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("Telegram delivery requires an acknowledged response and never persists bot credentials", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "telegram-"));
  const s = new Store(dir);
  try {
    await s.init();
    const f = fixture();
    const r = evaluate(f.snapshot, f.bars, new Date("2026-11-07"));
    r.status = "QUALIFIED";
    await queueAlert(s, r);
    let payload: any;
    await deliverAlerts(
      s,
      undefined,
      undefined,
      async (_url, init) => {
        payload = JSON.parse(init!.body as string);
        return Response.json({ ok: true });
      },
      { token: "PRIVATE_TEST_TOKEN", chatId: "123" },
    );
    assert.equal(payload.chat_id, "123");
    assert.ok(payload.text.includes("Research only"));
    assert.equal(s.read().alerts[0].status, "sent");
    assert.ok(!JSON.stringify(s.read()).includes("PRIVATE_TEST_TOKEN"));
  } finally {
    await s.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("An undelivered old qualification is superseded when risk changes", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "supersede-"));
  const s = new Store(dir);
  try {
    await s.init();
    const f = fixture();
    const r = evaluate(f.snapshot, f.bars, new Date("2026-11-07"));
    r.status = "QUALIFIED";
    await queueAlert(s, r);
    await queueAlert(s, {
      ...r,
      status: "REJECT",
      reasons: ["legal review: FAIL"],
    });
    assert.equal(s.read().alerts[0].status, "superseded");
    let sent = 0;
    await deliverAlerts(s, "https://example.test/hook", undefined, async () => {
      sent++;
      return new Response("ok");
    });
    assert.equal(sent, 1);
    assert.equal(s.read().alerts[1].result.status, "REJECT");
  } finally {
    await s.close();
    await rm(dir, { recursive: true, force: true });
  }
});
