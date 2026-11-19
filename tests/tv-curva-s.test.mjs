import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("la Curva S del modo TV dibuja el plan reprogramado y el sombreado del desvío", async () => {
  const tv = await readFile("app/tv/tv-client.tsx", "utf8");
  const css = await readFile("app/globals.css", "utf8");
  assert.match(tv, /reprogrammed\?: number \| null/);
  assert.match(tv, /className="tv-curve-reprogrammed"/);
  assert.match(tv, /tv-curve-gap \$\{area\.tone\}/);
  assert.match(tv, /Plan reprogramado/);
  assert.match(tv, /entry\.month\.slice\(0, 7\)/);
  assert.match(css, /\.tv-curve-reprogrammed \{/);
  assert.match(css, /\.tv-curve-gap\.danger/);
});
