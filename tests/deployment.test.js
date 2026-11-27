import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
test("deployment artifact contains only public files and selects Node 22", async () => {
  const build = spawnSync(process.execPath, [fileURLToPath(new URL("scripts/build.mjs", root))]);
  assert.equal(build.status, 0, build.stderr.toString());
  assert.deepEqual((await readdir(new URL("dist/", root))).sort(), ["assets", "index.html", "staticwebapp.config.json"]);
  assert.deepEqual((await readdir(new URL("dist/assets/", root))).sort(), ["config.js", "script.js", "styles.css"]);
  const config = JSON.parse(await readFile(new URL("dist/staticwebapp.config.json", root)));
  assert.equal(config.platform.apiRuntime, "node:22");
  assert.equal(await readFile(new URL("assets/styles.css", root), "utf8"), await readFile(new URL("dist/assets/styles.css", root), "utf8"));
});

test("Azure Functions v4 registers the expected anonymous GET endpoint", async () => {
  // The Functions worker normally provides this registration hook.
  const { createRequire } = await import("node:module");
  const require = createRequire(new URL("api/package.json", root));
  const azure = require("@azure/functions");
  const original = azure.app.http;
  let registration;
  azure.app.http = (name, options) => { registration = { name, ...options }; };
  try { await import("../api/src/functions/tenant.js"); }
  finally { azure.app.http = original; }
  assert.equal(registration.name, "tenantLookup");
  assert.equal(registration.route, "tenant");
  assert.equal(registration.authLevel, "anonymous");
  assert.deepEqual(registration.methods, ["GET"]);
  assert.equal(typeof registration.handler, "function");
});
