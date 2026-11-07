import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";

const derive = promisify(scrypt);
const salt = randomBytes(32);
const expected = config.OWNER_PASSWORD ? scryptSync(config.OWNER_PASSWORD, salt, 64) : null;
const sessions = new Map<string, number>();
const ttl = 8 * 60 * 60 * 1000;
const cookie = config.NODE_ENV === "production" ? "__Host-signaldesk" : "signaldesk-dev";
const options = {httpOnly: true, secure: config.NODE_ENV === "production", sameSite: "strict" as const, path: "/"};
function sessionId(req: Request): string | undefined {
  return req.headers.cookie?.split(";").map(v => v.trim()).find(v => v.startsWith(cookie + "="))?.slice(cookie.length + 1);
}
export function ownerSession(req: Request): boolean {
  const id = sessionId(req);
  if (!id) return false;
  const expiry = sessions.get(id);
  if (!expiry || expiry <= Date.now()) { sessions.delete(id); return false; }
  return true;
}
export function installPasswordAuth(app: Express) {
  if (!expected) return;
  app.use("/api/auth", (_req, res, next) => {res.setHeader("Cache-Control", "no-store"); next();});
  const limiter = rateLimit({windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false});
  app.post("/api/auth/login", limiter, async (req: Request, res: Response) => {
    const password = req.body?.password;
    if (typeof password !== "string" || password.length > 256 || password.length < 20)
      return res.status(401).json({error: "invalid_credentials", message: "Incorrect dashboard passphrase."});
    const actual = await derive(password, salt, 64) as Buffer;
    if (!timingSafeEqual(actual, expected))
      return res.status(401).json({error: "invalid_credentials", message: "Incorrect dashboard passphrase."});
    // Rotate on every login; expire old sessions, bound memory, never expose IDs in JSON.
    const prior = sessionId(req);
    if (prior) sessions.delete(prior);
    for (const [id, expires] of sessions) if (expires <= Date.now()) sessions.delete(id);
    if (sessions.size >= 32) sessions.delete(sessions.keys().next().value!);
    const id = randomBytes(32).toString("hex");
    sessions.set(id, Date.now() + ttl);
    res.cookie(cookie, id, {...options, maxAge: ttl});
    return res.json({authenticated: true});
  });
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const id = sessionId(req);
    if (id) sessions.delete(id);
    res.clearCookie(cookie, options);
    return res.json({authenticated: false});
  });
}
