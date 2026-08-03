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
  assert.doesNotMatch(source, /class="report-link"[^>]*target="_blank"/);
});

test("board uses flat six-cell match cards without stage columns", () => {
  const script = fs.readFileSync(path.join(docs, "assets/site.js"), "utf8");
  const styles = fs.readFileSync(path.join(docs, "assets/site.css"), "utf8");
  assert.match(script, /class="match-board-grid"/);
  assert.match(script, /class="odds-six-grid"/);
  assert.match(script, /outcomeOrder\.map\(\(outcome\) => renderOutcomeCell\(match, "had", outcome\)\)/);
  assert.match(script, /outcomeOrder\.map\(\(outcome\) => renderOutcomeCell\(match, "hhad", outcome\)\)/);
  assert.doesNotMatch(script, /const stageMeta/);
  assert.match(styles, /\.match-board-grid \{ display: grid;/);
  assert.match(styles, /\.outcome-cell\.is-recommended\.confidence-high/);
  assert.match(styles, /\.outcome-cell\.is-recommended\.confidence-medium/);
  assert.match(styles, /\.outcome-cell\.is-recommended\.confidence-low/);
  assert.match(script, /const recommended = isPrimary/);
  assert.match(script, /joint.*diagnostic|diagnostic.*joint|\u8054\u5408\u51c0\u80dc\u7403\u8bca\u65ad/i);
  assert.doesNotMatch(script, /联动推荐/);
  assert.match(styles, /\.outcome-cell\.is-diagnostic:not\(\.is-primary\)/);
  assert.match(script, /class="score-forecast"/);
  assert.match(script, /match\.analysis_detail\?\.top_scores/);
  assert.match(script, /最可能比分/);
  assert.match(styles, /\.score-forecast > div \{ display: grid; grid-template-columns: repeat\(3/);
});

test("results score only the locked strategy and label HHAD-only matches", () => {
  const script = fs.readFileSync(path.join(docs, "assets/site.js"), "utf8");
  const styles = fs.readFileSync(path.join(docs, "assets/site.css"), "utf8");
  assert.match(script, /match\.strategy_correct/);
  assert.match(script, /match\.primary_correct \?\? match\.strategy_correct/);
  assert.match(script, /settlement_scope === "hhad_only"/);
  assert.match(script, /终版\$\{scope\}命中/);
  assert.match(script, /终版\$\{scope\}错误/);
  assert.match(script, /模型推演 · \$\{label\}（未开售）/);
  assert.doesNotMatch(script, /correct_had \? "correct" : "missed"/);
  assert.doesNotMatch(script, /correct_hhad \? "correct" : "missed"/);
  assert.match(script, /▣ 查看复盘/);
  assert.match(styles, /\.check\.correct \{ color: var\(--red\); background: var\(--red-soft\)/);
  assert.match(styles, /\.check\.missed \{ color: #788496; background: #eef1f5/);
  assert.equal(styles.includes(".check.wrong"), false);
  assert.equal(styles.includes(".check.correct { color: var(--green)"), false);
});
