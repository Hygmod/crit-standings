const updatedAt = document.querySelector("#updated-at");
const tables = document.querySelector("#standings-tables");

const response = await fetch(`data/standings.json?cache=${Date.now()}`);
if (!response.ok) {
  throw new Error(`Unable to load standings: ${response.status}`);
}

const standings = await response.json();

updatedAt.textContent = `Updated ${formatDateTime(standings.generatedAt)}`;
renderStandings(standings.categories);

function renderStandings(categories) {
  if (categories.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No standings posted yet.";
    tables.replaceChildren(empty);
    return;
  }

  tables.replaceChildren(...categories.map(renderCategory));
}

function renderCategory(category) {
  const section = document.createElement("section");
  section.className = "table-region";

  const heading = document.createElement("h2");
  heading.textContent = category.label;

  const scroller = document.createElement("div");
  scroller.className = "table-scroll";

  const table = document.createElement("table");
  const head = document.createElement("thead");
  const body = document.createElement("tbody");
  const headerRow = document.createElement("tr");
  const nameHeaders = category.firstNameOnly ? ["First Name"] : ["Last Name", "First Name"];

  [...nameHeaders, "Racer #", "Total", "Vol", ...category.raceDates].forEach((label) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    headerRow.append(th);
  });
  head.append(headerRow);

  category.riders.forEach((rider) => {
    const row = document.createElement("tr");
    if (!category.firstNameOnly) {
      addCell(row, rider.lastName || "-", "name");
    }
    addCell(row, `${rider.firstName || rider.displayName}${rider.provisional ? "*" : ""}`, "name");
    addCell(row, rider.raceNumber || "-", "number");
    addCell(row, rider.total, "points");
    addCell(row, rider.volunteerDays, "volunteer");

    category.raceDates.forEach((date) => {
      const result = rider.results.find((entry) => entry.date === date);
      addCell(row, result?.value || "-", "race-result");
    });

    body.append(row);
  });

  table.append(head, body);
  scroller.append(table);
  section.append(heading, scroller);
  return section;
}

function addCell(row, value, className) {
  const cell = document.createElement("td");
  cell.className = className;
  cell.textContent = value;
  row.append(cell);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles"
  }).format(new Date(value));
}
