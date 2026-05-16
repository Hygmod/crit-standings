export const CATEGORY_CONFIG = [
  { sheetName: "1/2/3", label: "Cat 1/2/3", color: "#f46524", textColor: "#1f252b" },
  { sheetName: "A's", label: "A's", color: "#5b95f9", textColor: "#1f252b" },
  { sheetName: "B's", label: "B's", color: "#78909c", textColor: "#1f252b" },
  { sheetName: "Women", label: "Women", color: "#ef6767", textColor: "#1f252b" },
  { sheetName: "Masters", label: "Masters", color: "#f7cb4d", textColor: "#1f252b" },
  { sheetName: "Kids", label: "Kids", color: "#8bc34a", textColor: "#1f252b", firstNameOnly: true }
];

export function buildStandings(valuesBySheet, generatedAt = new Date().toISOString()) {
  const categories = CATEGORY_CONFIG.map((config) =>
    buildCategory(config, valuesBySheet[config.sheetName] ?? [])
  ).filter((category) => category.hasResults);

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
    color: config.color,
    textColor: config.textColor,
    firstNameOnly: Boolean(config.firstNameOnly),
    raceDates,
    hasResults: riders.some(hasResult),
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
    firstName,
    lastName: config.firstNameOnly ? "" : lastName,
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

function hasResult(rider) {
  return rider.total > 0 || rider.results.some((result) => isResultValue(result.value));
}

function isResultValue(value) {
  const cleaned = clean(value).toLowerCase();
  return Boolean(cleaned) && cleaned !== "v";
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
