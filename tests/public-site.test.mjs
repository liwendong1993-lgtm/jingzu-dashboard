import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docs = path.join(root, "docs");

test("public site has required static assets", () => {
  for (const relative of ["index.html", "assets/site.css", "assets/site.js", "data/index.json", ".nojekyll"]) {
    assert.equal(fs.existsSync(path.join(docs, relative)), true, `${relative} should exist`);
  }
});

test("public snapshots exclude local execution data", () => {
  const index = JSON.parse(fs.readFileSync(path.join(docs, "data/index.json"), "utf8"));
  assert.ok(index.dates.length > 0);
  for (const date of index.dates) {
    const raw = fs.readFileSync(path.join(docs, `data/${date}.json`), "utf8");
    const snapshot = JSON.parse(raw);
    assert.equal(snapshot.public_mode, true);
    assert.equal(Object.hasOwn(snapshot, "jobs"), false);
    assert.equal(raw.includes("127.0.0.1"), false);
    assert.equal(raw.includes("/api/actions/"), false);
    assert.ok(Array.isArray(snapshot.matches));
  }
});

test("public application never references the writable local API", () => {
  const source = ["index.html", "assets/site.js"].map((relative) => fs.readFileSync(path.join(docs, relative), "utf8")).join("\n");
  assert.equal(source.includes("127.0.0.1"), false);
  assert.equal(source.includes("/api/actions/"), false);
  assert.equal(source.includes("生成终版"), false);
});

test("results highlight hits only and keep misses neutral", () => {
  const script = fs.readFileSync(path.join(docs, "assets/site.js"), "utf8");
  const styles = fs.readFileSync(path.join(docs, "assets/site.css"), "utf8");
  assert.match(script, /correct_had \? "correct" : "missed"/);
  assert.match(script, /correct_hhad \? "correct" : "missed"/);
  assert.match(styles, /\.check\.correct \{ color: var\(--red\); background: var\(--red-soft\)/);
  assert.match(styles, /\.check\.missed \{ color: #788496; background: #eef1f5/);
});
