import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";
import { ensureValid, isNewer } from "../public/standings-data.js";

// These tests guard the load-time performance of the standings page.
// The page is fast because visitors download a small, pre-built JSON
// snapshot instead of waiting on a live Google Sheet read. A regression
// that bloats that payload, or that drops the snapshot fast path, would
// quietly bring back the "page looks broken" slow load.

// The snapshot is the only thing a visitor downloads to see results, so its
// size is the single biggest lever on load time. Real series data is a few
// KB; this ceiling still catches a catastrophic blow-up (e.g. embedding raw
// sheet rows) without being so tight it breaks on a normal season's worth.
const SNAPSHOT_BUDGET_BYTES = 256 * 1024;

// A generous large-series shape: every category full, every race run.
const RIDERS_PER_CATEGORY = 120;
const RACE_DATES = 10;

// Even a fully populated season must stay small enough to load instantly.
const BUILT_PAYLOAD_BUDGET_BYTES = 600 * 1024;
// Per-rider ceiling is the robust invariant: it catches duplicated or
// unbounded per-rider data even if the rider count stays the same.
const BYTES_PER_RIDER_BUDGET = 700;

function loadAppsScriptStandings() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(
    readFileSync(new URL("../apps-script/Standings.gs", import.meta.url), "utf8"),
    context,
    { filename: "apps-script/Standings.gs" }
  );
  return {
    buildStandings: (...args) => JSON.parse(JSON.stringify(context.buildStandings(...args))),
    categoryConfig: context.CATEGORY_CONFIG
  };
}

function syntheticSheet(riderCount, dateCount) {
  const dates = Array.from({ length: dateCount }, (_, i) => `${(i % 12) + 1}/${(i % 27) + 1}`);
  const riders = Array.from({ length: riderCount }, (_, i) => {
    const results = dates.map((_, d) => String((i * 7 + d) % 50));
    return [`Lastname${i}`, `Firstname${i}`, String(1000 + i), String(150 - i), String(i % 3), ...results];
  });
  return [
    ["Chico Airport Crit Standings"],
    ["Category"],
    ['"V" as score indicates Volunteer duty'],
    ["Last Name", "First Name", "Racer #", "Total", "Vol", ...dates],
    ...riders
  ];
}

test("published standings snapshots stay within the load-time budget", () => {
  const dataDir = new URL("../public/data/", import.meta.url);
  const snapshots = readdirSync(dataDir).filter((name) => /^standings.*\.json$/.test(name));

  assert.ok(snapshots.length > 0, "expected at least one standings JSON file in public/data");

  for (const name of snapshots) {
    const raw = readFileSync(new URL(name, dataDir), "utf8");
    const parsed = JSON.parse(raw);
    assert.ok(Array.isArray(parsed.categories), `${name} is missing a categories array`);
    assert.ok(
      Buffer.byteLength(raw) < SNAPSHOT_BUDGET_BYTES,
      `${name} is ${Buffer.byteLength(raw)} bytes, over the ${SNAPSHOT_BUDGET_BYTES}-byte budget`
    );
  }
});

test("a fully populated season builds a payload small enough to load fast", () => {
  const { buildStandings, categoryConfig } = loadAppsScriptStandings();

  const valuesBySheet = {};
  categoryConfig.forEach((config) => {
    valuesBySheet[config.sheetName] = syntheticSheet(RIDERS_PER_CATEGORY, RACE_DATES);
  });

  const standings = buildStandings(valuesBySheet, "2026-05-15T00:00:00.000Z");
  const json = JSON.stringify(standings);
  const bytes = Buffer.byteLength(json);
  const riderCount = standings.categories.reduce((sum, category) => sum + category.riders.length, 0);

  assert.ok(riderCount > 0, "expected the synthetic season to produce riders");
  assert.ok(
    bytes < BUILT_PAYLOAD_BUDGET_BYTES,
    `built payload is ${bytes} bytes, over the ${BUILT_PAYLOAD_BUDGET_BYTES}-byte budget`
  );

  const bytesPerRider = bytes / riderCount;
  assert.ok(
    bytesPerRider < BYTES_PER_RIDER_BUDGET,
    `payload is ${bytesPerRider.toFixed(0)} bytes/rider, over the ${BYTES_PER_RIDER_BUDGET} budget`
  );
});

test("the page loads the static snapshot before the live endpoint", () => {
  const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

  const loadStandings = source.match(/async function loadStandings\(\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(loadStandings, "could not find loadStandings() in app.js");

  const body = loadStandings[1];
  const snapshotAt = body.indexOf("STANDINGS_SNAPSHOT_URL");
  const liveAt = body.indexOf("loadLive");

  assert.ok(snapshotAt !== -1, "loadStandings() must read the static snapshot first");
  assert.ok(
    liveAt === -1 || snapshotAt < liveAt,
    "the snapshot must be attempted before the live endpoint so the page is not blocked on it"
  );
});

test("isNewer only accepts a strictly fresher payload", () => {
  assert.equal(isNewer("2026-05-15T12:00:00Z", "2026-05-15T11:00:00Z"), true);
  assert.equal(isNewer("2026-05-15T11:00:00Z", "2026-05-15T12:00:00Z"), false);
  assert.equal(isNewer("2026-05-15T12:00:00Z", "2026-05-15T12:00:00Z"), false);
  assert.equal(isNewer("2026-05-15T12:00:00Z", "not-a-date"), true);
  assert.equal(isNewer("not-a-date", "2026-05-15T12:00:00Z"), false);
});

test("ensureValid rejects empty or errored payloads", () => {
  const ok = { generatedAt: "2026-05-15T12:00:00Z", categories: [] };
  assert.equal(ensureValid(ok), ok);
  assert.throws(() => ensureValid(null));
  assert.throws(() => ensureValid({ error: "Standings are temporarily unavailable." }));
});
