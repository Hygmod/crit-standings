var CATEGORY_CONFIG = [
  { sheetName: "1/2/3", label: "Cat 1/2/3", color: "#f46524", textColor: "#1f252b" },
  { sheetName: "A's", label: "A's", color: "#5b95f9", textColor: "#1f252b" },
  { sheetName: "B's", label: "B's", color: "#78909c", textColor: "#1f252b" },
  { sheetName: "Women", label: "Women", color: "#ef6767", textColor: "#1f252b" },
  { sheetName: "Masters", label: "Masters", color: "#f7cb4d", textColor: "#1f252b" },
  { sheetName: "Kids", label: "Kids", color: "#8bc34a", textColor: "#1f252b", firstNameOnly: true, volunteerExempt: true }
];

function buildStandings(valuesBySheet, generatedAt) {
  var timestamp = generatedAt || new Date().toISOString();
  var categories = CATEGORY_CONFIG.map(function(config) {
    return buildCategory(config, valuesBySheet[config.sheetName] || []);
  }).filter(function(category) {
    return category.hasResults;
  });

  return {
    event: "2026 Chico Airport Criterium",
    generatedAt: timestamp,
    volunteerRequirement: 2,
    categories: categories
  };
}

function buildCategory(config, rows) {
  var headers = rows[3] || [];
  var columns = resolveColumns(headers);
  var riders = rows
    .slice(4)
    .map(function(row) {
      return buildRider(row, columns, config);
    })
    .filter(Boolean)
    .sort(compareRiders)
    .map(function(rider, index, sorted) {
      rider.rank = rankFor(index, sorted);
      return rider;
    });

  return {
    id: slugify(config.label),
    label: config.label,
    sheetName: config.sheetName,
    color: config.color,
    textColor: config.textColor,
    firstNameOnly: Boolean(config.firstNameOnly),
    raceDates: columns.raceDates.map(function(column) { return column.date; }),
    hasResults: riders.some(hasResult),
    riders: riders
  };
}

// Resolve column positions from the header row by name rather than assuming a
// fixed order. Categories label columns "Total" and "Vol", but some sheets swap
// them (Masters) or omit "Vol" entirely (Kids). Everything after the metadata
// and Total/Vol columns is treated as a race-date column.
function resolveColumns(headers) {
  var totalIndex = -1;
  var volIndex = -1;
  for (var i = 0; i < headers.length; i++) {
    var name = clean(headers[i]).toLowerCase();
    if (totalIndex === -1 && name === "total") {
      totalIndex = i;
    } else if (volIndex === -1 && name === "vol") {
      volIndex = i;
    }
  }
  if (totalIndex === -1) {
    totalIndex = 3;
  }

  var raceDates = [];
  for (var j = 3; j < headers.length; j++) {
    if (j === totalIndex || j === volIndex) {
      continue;
    }
    var date = clean(headers[j]);
    if (date) {
      raceDates.push({ index: j, date: date });
    }
  }

  return { totalIndex: totalIndex, volIndex: volIndex, raceDates: raceDates };
}

function buildRider(row, columns, config) {
  var lastName = clean(row[0]);
  var firstName = clean(row[1]);
  var raceNumber = clean(row[2]);

  if (!firstName && !lastName && !raceNumber) {
    return null;
  }

  var total = toNumber(row[columns.totalIndex]);
  var volunteerDays = columns.volIndex === -1 ? 0 : toNumber(row[columns.volIndex]);
  var displayName = config.firstNameOnly
    ? firstName || "Rider"
    : [firstName, lastName].filter(Boolean).join(" ");

  return {
    displayName: displayName,
    firstName: firstName,
    lastName: config.firstNameOnly ? "" : lastName,
    raceNumber: raceNumber,
    total: total,
    volunteerDays: volunteerDays,
    provisional: config.volunteerExempt ? false : volunteerDays < 2,
    results: columns.raceDates.map(function(column) {
      return {
        date: column.date,
        value: clean(row[column.index])
      };
    })
  };
}

function hasResult(rider) {
  return rider.total > 0 || rider.results.some(function(result) {
    return isResultValue(result.value);
  });
}

function isResultValue(value) {
  var cleaned = clean(value).toLowerCase();
  return Boolean(cleaned) && cleaned !== "v";
}

function compareRiders(a, b) {
  if (b.total !== a.total) return b.total - a.total;
  if (b.volunteerDays !== a.volunteerDays) return b.volunteerDays - a.volunteerDays;
  return a.displayName.localeCompare(b.displayName, "en", { sensitivity: "base" });
}

function rankFor(index, riders) {
  if (index === 0) return 1;
  var current = riders[index];
  var previous = riders[index - 1];
  return current.total === previous.total ? previous.rank : index + 1;
}

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function toNumber(value) {
  var parsed = Number.parseFloat(clean(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
