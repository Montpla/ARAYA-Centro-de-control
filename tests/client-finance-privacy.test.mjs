import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function javascriptFiles(root) {
  const files = [];
  async function walk(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(target);
      else if (/\.(?:js|mjs)$/.test(entry.name)) files.push(target);
    }
  }
  await walk(root);
  return files;
}

test("financial datasets are server-provided and absent from the public client bundle", async () => {
  const clientSource = await readFile("app/dashboard-client.tsx", "utf8");
  assert.match(clientSource, /import\s+type\s+\{[\s\S]*?\}\s+from "\.\/demo-data"/);
  for (const moduleName of [
    "june-report-data",
    "antonely-finance-data",
    "procurement-data",
    "reprogrammed-flow-data",
    "fiduciary-statements-data",
    "data-governance",
  ]) {
    assert.doesNotMatch(clientSource, new RegExp(`from ["']\\./${moduleName}["']`));
  }

  const sentinels = [
    "3591280577.17",
    "758765771.05",
    "18627534.91",
    "202373400.47",
    "136840.39",
  ];
  for (const sentinel of sentinels) assert.doesNotMatch(clientSource, new RegExp(sentinel.replace(".", "\\.")));

  const clientFiles = [
    ...(await javascriptFiles("dist/client")),
    ...(await javascriptFiles(".next/static")),
  ];
  assert.ok(clientFiles.length > 0, "the production build must emit inspectable client JavaScript");
  const publicBundle = (await Promise.all(clientFiles.map((file) => readFile(file, "utf8")))).join("\n");
  for (const sentinel of sentinels) assert.ok(!publicBundle.includes(sentinel), `${sentinel} leaked into client JavaScript`);
});

test("authorization bootstrap and service worker fail closed", async () => {
  const [page, shell, bootstrap, client, worker] = await Promise.all([
    readFile("app/page.tsx", "utf8"),
    readFile("app/dashboard-shell.tsx", "utf8"),
    readFile("lib/dashboard-bootstrap.ts", "utf8"),
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("public/sw.js", "utf8"),
  ]);

  assert.match(page, /buildDashboardBootstrap\(currentUser\.financeAccess\)/);
  assert.match(shell, /ssr:\s*false/);
  assert.match(bootstrap, /mixedFinanceSourceIds/);
  assert.match(bootstrap, /relationships:\s*\[\]/);
  assert.match(bootstrap, /creditTerms:\s*\[\]/);
  assert.match(bootstrap, /creditLimitDop:\s*0/);
  assert.match(client, /refreshedUser\.financeAccess\s*!==\s*currentUser\.financeAccess/);
  assert.match(client, /CLEAR_PRIVATE_CACHE/);

  assert.doesNotMatch(worker, /cache\.put\("\/"/);
  assert.doesNotMatch(worker, /caches\.match\("\/"/);
  assert.doesNotMatch(client, /resourceUrls:\s*\["\/"/);
  assert.match(worker, /url\.pathname\.startsWith\("\/assets\/"\)/);
});
