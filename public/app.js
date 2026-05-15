const tabs = document.querySelector("#category-tabs");
const title = document.querySelector("#category-title");
const updatedAt = document.querySelector("#updated-at");
const head = document.querySelector("#standings-head");
const body = document.querySelector("#standings-body");

const response = await fetch(`data/standings.json?cache=${Date.now()}`);
if (!response.ok) {
  throw new Error(`Unable to load standings: ${response.status}`);
}

const standings = await response.json();
const populatedCategories = standings.categories.filter((category) => category.riders.length > 0);
const categories = populatedCategories.length > 0 ? populatedCategories : standings.categories;
let activeCategory = categories[0];

updatedAt.textContent = `Updated ${formatDateTime(standings.generatedAt)}`;
renderTabs();
renderCategory(activeCategory);

function renderTabs() {
  tabs.replaceChildren(
    ...categories.map((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "category-tab";
      button.textContent = category.label;
      button.setAttribute("aria-pressed", String(category.id === activeCategory.id));
      button.addEventListener("click", () => {
        activeCategory = category;
        renderTabs();
        renderCategory(category);
      });
      return button;
    })
  );
}

function renderCategory(category) {
  title.textContent = category.label;
  const visibleDates = category.raceDates.filter((date) =>
    category.riders.some((rider) => rider.results.some((result) => result.date === date && result.value))
  );

  head.innerHTML = "";
  body.innerHTML = "";

  const headerRow = document.createElement("tr");
  ["Rank", "Rider", "#", "Points", "Vol", ...visibleDates].forEach((label) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    headerRow.append(th);
  });
  head.append(headerRow);

  if (category.riders.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5 + visibleDates.length;
    cell.className = "empty";
    cell.textContent = "No standings posted yet.";
    row.append(cell);
    body.append(row);
    return;
  }

  category.riders.forEach((rider) => {
    const row = document.createElement("tr");
    addCell(row, rider.rank, "rank");
    addCell(row, `${rider.displayName}${rider.provisional ? "*" : ""}`, "rider");
    addCell(row, rider.raceNumber || "-", "number");
    addCell(row, rider.total, "points");
    addCell(row, rider.volunteerDays, "volunteer");

    visibleDates.forEach((date) => {
      const result = rider.results.find((entry) => entry.date === date);
      addCell(row, result?.value || "-", "race-result");
    });

    body.append(row);
  });
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
