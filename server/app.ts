import crypto from "node:crypto";
import path from "node:path";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";
import { requireAuth, requireScope } from "./auth.js";
import { config } from "./config.js";
import { getMarketQuote, providerStatuses } from "./providers/index.js";
import { ProviderError } from "./providers/types.js";
import { snapshot, bar, market } from "../shared/schema.js";
import { universe } from "./universe.js";
import type { Store } from "./store.js";
import type { Worker } from "./worker.js";
export function createApp(store: Store, worker: Worker) {
  const app = express();
  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", 1);
  app.use((_req, res, next) => {
    res.setHeader("X-Request-Id", crypto.randomUUID());
    next();
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'", ...config.allowedOrigins],
          imgSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      strictTransportSecurity:
        config.NODE_ENV === "production" ? undefined : false,
    }),
  );
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || config.allowedOrigins.has(origin)) return cb(null, true);
        cb(null, false);
      },
      methods: ["GET", "POST"],
      allowedHeaders: ["Authorization", "Content-Type"],
      credentials: false,
    }),
  );
  // Explicitly reject foreign browser origins even on mutation requests that don't need a preflight.
  app.use("/api", (req, res, next) => {
    const origin = req.header("origin");
    if (origin && !config.allowedOrigins.has(origin))
      return res.status(403).json({ error: "origin_not_allowed" });
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 120,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use(express.json({ limit: "2mb", strict: true }));
  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", researchOnly: true }),
  );
  app.get("/api/session", (_req, res) =>
    res.json({
      authentication: config.authEnabled ? "oidc" : "local-loopback",
      researchOnly: true,
    }),
  );
  app.use(
    "/api",
    requireAuth,
    requireScope("research:read"),
    (_req, res, next) => {
      res.setHeader("Cache-Control", "no-store");
      next();
    },
  );
  app.get("/api/market/status", (_req, res) => {
    const s = store.read();
    res.json({
      mode: "research",
      providers: providerStatuses(),
      historyConfigured: Boolean(config.EODHD_API_TOKEN),
      notificationConfigured: Boolean(
        config.NOTIFICATION_WEBHOOK_URL || config.TELEGRAM_BOT_TOKEN,
      ),
      lastScan: s.lastScan,
      lastWorkerError: s.lastWorkerError,
      universeSize: universe.length,
      intervalMinutes: config.SCAN_INTERVAL_MINUTES,
      scannerEnabled: config.SCANNER_ENABLED === "true",
      researchOnly: true,
      notice:
        "Credentials configured does not mean connected. All scanner prices are dated daily CLOSE; no live entitlement is assumed. Fundamentals access may require a separate paid entitlement. Imported evidence can be used without a provider.",
    });
  });
  app.get("/api/market/quote", async (req, res, next) => {
    const q = z
      .object({ market, symbol: z.string().regex(/^[A-Za-z0-9._|:-]{1,80}$/) })
      .safeParse(req.query);
    if (!q.success)
      return res.status(400).json({ error: "invalid_market_or_symbol" });
    try {
      res.json(await getMarketQuote(q.data.market, q.data.symbol));
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/universe", (_req, res) => res.json(universe));
  app.get("/api/scans", (_req, res) =>
    res.json(Object.values(store.read().results)),
  );
  app.get("/api/jobs", (_req, res) =>
    res.json(store.read().jobs.slice(-100).reverse()),
  );
  app.get("/api/alerts", (_req, res) =>
    res.json(
      store
        .read()
        .alerts.slice(-100)
        .reverse()
        .map((a) => ({ ...a, lastError: a.lastError })),
    ),
  );
  app.get("/api/snapshots", (_req, res) =>
    res.json(Object.values(store.read().snapshots)),
  );
  app.get("/api/portfolio", requireScope("portfolio:read"), (_req, res) =>
    res.json({
      holdings: store.read().holdings ?? [],
      notice:
        "Manual holdings. No broker connected; totals must stay separated by currency.",
    }),
  );
  app.post(
    "/api/portfolio",
    requireScope("portfolio:write"),
    async (req, res, next) => {
      const p = z
        .array(
          z.object({
            symbol: z.string().regex(/^[A-Z0-9.-]{1,30}$/),
            market,
            currency: z.enum(["USD", "CAD", "INR"]),
            shares: z.number().finite().positive(),
            bookCost: z.number().finite().nonnegative(),
          }),
        )
        .max(200)
        .safeParse(req.body);
      if (!p.success)
        return res.status(400).json({ error: "invalid_holdings" });
      const keys = p.data.map((x) => `${x.market}:${x.symbol}`);
      if (new Set(keys).size !== keys.length)
        return res.status(400).json({ error: "duplicate_position" });
      if (
        p.data.some(
          (x) =>
            x.currency !==
            { USA: "USD", CANADA: "CAD", INDIA: "INR" }[x.market],
        )
      )
        return res.status(400).json({ error: "currency_mismatch" });
      try {
        await store.mutate((s) => {
          s.holdings = p.data;
        });
        res.json({ saved: p.data.length });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get("/api/evidence", (_req, res) =>
    res.json(store.read().evidence ?? []),
  );
  app.post(
    "/api/evidence",
    requireScope("research:write"),
    async (req, res, next) => {
      const p = z
        .object({
          key: z.string().max(50),
          kind: z.enum([
            "FILING",
            "NEWS",
            "INSIDER",
            "INSTITUTIONAL",
            "FII_DII",
            "CONTRACT",
            "RISK",
          ]),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          url: z
            .string()
            .url()
            .refine((x) => /^https?:/.test(x)),
          facts: z.string().min(10).max(6000),
          interpretation: z.string().max(3000),
        })
        .safeParse(req.body);
      if (
        !p.success ||
        p.data.date > new Date().toISOString().slice(0, 10) ||
        !universe.some((x) => `${x.market}:${x.symbol}` === p.data.key)
      )
        return res.status(400).json({ error: "invalid_evidence" });
      try {
        const entry = {
          ...p.data,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        await store.mutate((s) => {
          s.evidence ??= [];
          s.evidence.push(entry);
        });
        res.status(201).json(entry);
      } catch (e) {
        next(e);
      }
    },
  );

  app.post(
    "/api/research",
    requireScope("research:write"),
    async (req, res, next) => {
      const p = z
        .object({ key: z.string().min(1).max(50) })
        .safeParse(req.body);
      if (!p.success) return res.status(400).json({ error: "invalid_request" });
      try {
        const job = await worker.enqueue(p.data.key, req.auth!.subject);
        res.status(202).json(job);
        void worker.tick().catch(() =>
          store.mutate((s) => {
            s.lastWorkerError = "Research worker failed";
          }),
        );
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/import",
    requireScope("research:write"),
    async (req, res, next) => {
      const p = z
        .object({ snapshot, bars: z.array(bar).min(200).max(6000) })
        .safeParse(req.body);
      if (!p.success)
        return res.status(400).json({
          error: "invalid_dataset",
          fields: p.error.issues.map((i) => ({
            path: i.path,
            message: i.message,
          })),
        });
      const data = p.data,
        key = `${data.snapshot.market}:${data.snapshot.symbol}`,
        now = new Date().toISOString();
      if (!universe.some((x) => `${x.market}:${x.symbol}` === key))
        return res.status(400).json({ error: "security_not_in_universe" });
      if (
        Date.parse(data.snapshot.asOf) > Date.parse(now) ||
        data.bars.some(
          (b, i) =>
            b.date > now.slice(0, 10) ||
            (i > 0 && b.date <= data.bars[i - 1].date),
        )
      )
        return res.status(400).json({ error: "future_or_unordered_data" });
      // Reviewed imports retain original reviewer and record authenticated importer separately in the job.
      try {
        await store.mutate((s) => {
          s.snapshots[key] = data.snapshot;
          s.history[key] = { fetchedAt: now, bars: data.bars };
        });
        const job = await worker.enqueue(key, req.auth!.subject);
        res.status(202).json(job);
        void worker.tick().catch(() =>
          store.mutate((s) => {
            s.lastWorkerError = "Import research failed";
          }),
        );
      } catch (e) {
        next(e);
      }
    },
  );
  app.use("/api", (_req, res) => res.status(404).json({ error: "not_found" }));
  app.use(express.static(path.resolve("dist"), { index: "index.html" }));
  app.get("/", (_req, res) => res.sendFile(path.resolve("dist/index.html")));
  const errors: ErrorRequestHandler = (e, _req, res, _next) => {
    if (e instanceof ProviderError)
      return res
        .status(e.status)
        .json({ error: "provider_unavailable", message: e.message });
    if (e?.type === "entity.too.large")
      return res.status(413).json({ error: "dataset_too_large" });
    if (e instanceof SyntaxError)
      return res.status(400).json({ error: "invalid_json" });
    res.status(500).json({
      error: "request_failed",
      message:
        "Request could not be completed. Check input, configuration and server health.",
    });
  };
  app.use(errors);
  return app;
}
