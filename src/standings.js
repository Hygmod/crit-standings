export const CATEGORY_CONFIG = [
  { sheetName: "1/2/3", label: "Cat 1/2/3" },
  { sheetName: "A's", label: "A's" },
  { sheetName: "B's", label: "B's" },
  { sheetName: "Women", label: "Women" },
  { sheetName: "Masters", label: "Masters" },
  { sheetName: "Kids", label: "Kids", firstNameOnly: true }
];

export function buildStandings(valuesBySheet, generatedAt = new Date().toISOString()) {
  const categories = CATEGORY_CONFIG.map((config) =>
    buildCategory(config, valuesBySheet[config.sheetName] ?? [])
  );

  return {
    event: "2026 Chico Airport Criterium",
    generatedAt,
    volunteerRequirement: 2,
    categories
  };
}

export function buildCategory(config, rows) {
  const headers = rows[3] ?? [];
  const raceDates = headers.slice(5).filter(Boolean);
  const riders = rows
    .slice(4)
    .map((row) => buildRider(row, raceDates, config))
    .filter(Boolean)
    .sort(compareRiders)
    .map((rider, index, sorted) => ({
      ...rider,
      rank: rankFor(index, sorted)
    }));

  return {
    id: slugify(config.label),
    label: config.label,
    sheetName: config.sheetName,
    firstNameOnly: Boolean(config.firstNameOnly),
    raceDates,
    riders
  };
}

function buildRider(row, raceDates, config) {
  const lastName = clean(row[0]);
  const firstName = clean(row[1]);
  const raceNumber = clean(row[2]);

  if (!firstName && !lastName && !raceNumber) {
    return null;
  }

  const total = toNumber(row[3]);
  const volunteerDays = toNumber(row[4]);
  const displayName = config.firstNameOnly
    ? firstName || "Rider"
    : [firstName, lastName].filter(Boolean).join(" ");

  return {
    displayName,
    raceNumber,
    total,
    volunteerDays,
    provisional: volunteerDays < 2,
    results: raceDates.map((date, offset) => ({
      date,
      value: clean(row[offset + 5])
    }))
  };
}

function compareRiders(a, b) {
  if (b.total !== a.total) return b.total - a.total;
  if (b.volunteerDays !== a.volunteerDays) return b.volunteerDays - a.volunteerDays;
  return a.displayName.localeCompare(b.displayName, "en", { sensitivity: "base" });
}

function rankFor(index, riders) {
  if (index === 0) return 1;
  const current = riders[index];
  const previous = riders[index - 1];
  return current.total === previous.total ? previous.rank : index + 1;
}

function clean(value) {
  return String(value ?? "").trim();
}

function toNumber(value) {
  const parsed = Number.parseFloat(clean(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
