import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
test("OIDC verifies owner, audience and scope; absent/invalid tokens never access private data", async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  Object.assign(jwk, { kid: "test-key", alg: "RS256", use: "sig" });
  const jwks = createServer((_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ keys: [jwk] }));
  }).listen(0, "127.0.0.1");
  await new Promise<void>((r) => jwks.once("listening", () => r()));
  const issuer = `http://127.0.0.1:${(jwks.address() as { port: number }).port}/`;
  process.env.OIDC_ISSUER = issuer;
  process.env.OIDC_AUDIENCE = "signaldesk-test";
  process.env.OWNER_SUB = "owner-test";
  const [{ Store }, { Worker }, { createApp }] = await Promise.all([
    import("../server/store.js"),
    import("../server/worker.js"),
    import("../server/app.js"),
  ]);
  const dir = await mkdtemp(path.join(os.tmpdir(), "auth-"));
  const store = new Store(dir);
  await store.init();
  const worker = new Worker(
    store,
    {
      async history() {
        throw Error("unused");
      },
      async fundamentals() {
        throw Error("unused");
      },
    },
    { batch: 1 },
  );
  const server = createApp(store, worker).listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", () => r()));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const token = async (subject: string, audience: string, scope: string) =>
    new SignJWT({ scope })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime("2m")
      .sign(privateKey);
  const get = (jwt?: string) =>
    fetch(base + "/api/universe", {
      headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
    });
  try {
    assert.equal((await get()).status, 401);
    assert.equal((await get("invalid")).status, 401);
    assert.equal(
      (await get(await token("owner-test", "wrong", "research:read"))).status,
      401,
    );
    assert.equal(
      (await get(await token("other", "signaldesk-test", "research:read")))
        .status,
      403,
    );
    assert.equal(
      (
        await get(
          await token("owner-test", "signaldesk-test", "portfolio:read"),
        )
      ).status,
      403,
    );
    assert.equal(
      (await get(await token("owner-test", "signaldesk-test", "research:read")))
        .status,
      200,
    );
  } finally {
    await worker.stop();
    await new Promise<void>((r) => server.close(() => r()));
    await store.close();
    await rm(dir, { recursive: true, force: true });
    await new Promise<void>((r) => jwks.close(() => r()));
  }
});
