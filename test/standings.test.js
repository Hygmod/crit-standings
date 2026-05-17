import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const { buildStandings } = loadAppsScriptStandings();

function loadAppsScriptStandings() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(
    readFileSync(new URL("../apps-script/Standings.gs", import.meta.url), "utf8"),
    context,
    { filename: "apps-script/Standings.gs" }
  );
  return {
    buildStandings: (...args) => JSON.parse(JSON.stringify(context.buildStandings(...args)))
  };
}

test("sorts riders by points and marks missing volunteer days", () => {
  const standings = buildStandings({
    "1/2/3": [
      ["Chico Airport Crit Standings"],
      ["CAT 1/2/3"],
      ['"V" as score indicates Volunteer duty'],
      ["Last Name", "First Name", "Racer #", "Total", "Vol", "5/5", "5/12"],
      ["Zaine", "John", "243", "0", "1", "", "V"],
      ["Villahermosa", "Myles", "244", "20", "0", "", "20"],
      ["Gavato", "Wil", "270", "25", "2", "", "25"]
    ]
  }, "2026-05-15T00:00:00.000Z");

  const category = standings.categories.find((item) => item.sheetName === "1/2/3");
  assert.equal(category.color, "#f46524");
  assert.equal(category.textColor, "#1f252b");
  assert.equal(category.riders[0].displayName, "Wil Gavato");
  assert.equal(category.riders[0].provisional, false);
  assert.equal(category.riders[1].displayName, "Myles Villahermosa");
  assert.equal(category.riders[1].provisional, true);
  assert.equal(category.riders[2].displayName, "John Zaine");
});

test("publishes kids by first name only", () => {
  const standings = buildStandings({
    Kids: [
      ["Chico Airport Crit Standings"],
      ["Kids"],
      [""],
      ["Last Name", "First Name", "Racer #", "Total", "Vol", "5/5"],
      ["Example", "Sam", "12", "5", "2", "5"]
    ]
  }, "2026-05-15T00:00:00.000Z");

  const kids = standings.categories.find((item) => item.sheetName === "Kids");
  assert.equal(kids.riders[0].displayName, "Sam");
  assert.equal(kids.riders[0].raceNumber, "12");
});

test("kids are exempt from the volunteer asterisk", () => {
  const standings = buildStandings({
    Kids: [
      ["Chico Airport Crit Standings"],
      ["Kids"],
      [""],
      ["Last Name", "First Name", "Racer #", "Total", "Vol", "5/5"],
      ["Example", "Sam", "12", "5", "0", "5"]
    ]
  }, "2026-05-15T00:00:00.000Z");

  const kids = standings.categories.find((item) => item.sheetName === "Kids");
  assert.equal(kids.riders[0].volunteerDays, 0);
  assert.equal(kids.riders[0].provisional, false);
});

test("does not publish roster-only or volunteer-only categories", () => {
  const standings = buildStandings({
    "B's": [
      ["Chico Airport Crit Standings"],
      ["CAT B"],
      [""],
      ["Last Name", "First Name", "Racer #", "Total", "Vol", "5/5", "5/12"],
      ["Starmer", "Kellen", "80", "0", "1", "v", ""],
      ["Rieniets", "Travis", "34", "0", "1", "", "V"]
    ],
    Kids: [
      ["Chico Airport Crit Standings"],
      ["Kids"],
      [""],
      ["Last Name", "First Name", "Racer #", "Total", "Vol", "5/5"],
      ["Example", "Sam", "12", "0", "0", ""]
    ]
  }, "2026-05-15T00:00:00.000Z");

  assert.deepEqual(standings.categories, []);
});
