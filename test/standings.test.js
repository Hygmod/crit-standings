import test from "node:test";
import assert from "node:assert/strict";
import { buildStandings } from "../src/standings.js";

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
  assert.equal(category.riders[0].displayName, "Wil Gavato");
  assert.equal(category.riders[0].provisional, false);
  assert.equal(category.riders[1].displayName, "Myles Villahermosa");
  assert.equal(category.riders[1].provisional, true);
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
