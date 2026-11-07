import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("personal login protects data, rejects CSRF and invalid credentials, rotates and revokes sessions", async () => {
  process.env.NODE_ENV = "production";
  process.env.OWNER_PASSWORD = "test-only-owner-passphrase-not-real";
  delete process.env.EODHD_API_TOKEN;
  delete process.env.TWELVE_DATA_API_KEY;
  delete process.env.UPSTOX_ACCESS_TOKEN;
  delete process.env.OIDC_ISSUER;
  delete process.env.OIDC_AUDIENCE;
  process.env.ALLOWED_ORIGINS = "";
  process.env.RENDER_EXTERNAL_URL = "https://personal.example";
  const [{Store}, {Worker}, {createApp}] = await Promise.all([
    import("../server/store.js"), import("../server/worker.js"), import("../server/app.js")
  ]);
  const dir = await mkdtemp(path.join(os.tmpdir(), "password-auth-"));
  const store = new Store(dir); await store.init();
  const worker = new Worker(store, {async history(){throw Error("unused");}, async fundamentals(){throw Error("unused");}}, {batch: 1});
  const server = createApp(store, worker).listen(0, "127.0.0.1");
  await new Promise<void>(r => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as {port:number}).port}`;
  const post = (route: string, body: unknown, cookie?: string, origin = "https://personal.example") => fetch(base+route, {method:"POST", headers:{"Content-Type":"application/json", ...(origin ? {Origin:origin}:{}), ...(cookie?{Cookie:cookie}:{})}, body: JSON.stringify(body)});
  const get = (cookie?:string) => fetch(base+"/api/portfolio", {headers: cookie?{Cookie:cookie}:{}});
  try {
    assert.equal((await get()).status,401);
    assert.equal((await get("__Host-signaldesk=forged")).status,401);
    assert.equal((await post("/api/auth/login", {password:process.env.OWNER_PASSWORD},undefined,"https://evil.example")).status,403);
    assert.equal((await post("/api/auth/login", {password:process.env.OWNER_PASSWORD},undefined,"")).status,403);
    assert.equal((await post("/api/auth/login", {password:"incorrect-password-is-long"})).status,401);
    const login=await post("/api/auth/login", {password:process.env.OWNER_PASSWORD});
    assert.equal(login.status,200);
    const header=login.headers.get("set-cookie")!;
    assert.match(header,/Secure/i); assert.match(header,/__Host-signaldesk=/); assert.match(header,/HttpOnly/i); assert.match(header,/SameSite=Strict/i);
    assert.match(header,/Max-Age=28800/i);
    const cookie=header.split(";")[0];
    assert.equal((await get(cookie)).status,200);
    assert.equal((await fetch(base+"/api/market/universe-quote?key=USA:MWA",{headers:{Cookie:cookie}})).status,503);
    assert.equal((await post("/api/portfolio",[],cookie,"https://evil.example")).status,403);
    const second=await post("/api/auth/login",{password:process.env.OWNER_PASSWORD},cookie);
    assert.equal(second.status,200);
    assert.equal((await get(cookie)).status,401);
    const current=second.headers.get("set-cookie")!.split(";")[0];
    assert.equal((await get(current)).status,200);
    assert.equal((await post("/api/auth/logout",{},current)).status,200);
    assert.equal((await get(current)).status,401);
    for(let i=0;i<7;i++) await post("/api/auth/login",{password:"incorrect-password-is-long"});
    assert.equal((await post("/api/auth/login",{password:process.env.OWNER_PASSWORD})).status,429);
  } finally {
    await worker.stop(); await new Promise<void>(r=>server.close(()=>r()));
    await store.close(); await rm(dir,{recursive:true,force:true});
  }
});
