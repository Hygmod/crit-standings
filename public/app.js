import { STANDINGS_DATA_URL, STANDINGS_SNAPSHOT_URL } from "./config.js";

const updatedAt = document.querySelector("#updated-at");
const tables = document.querySelector("#standings-tables");
const searchInput = document.querySelector("#rider-search");
const searchEmpty = document.querySelector("#search-empty");

const SEARCH_STORAGE_KEY = "crit-standings-search";
let activeQuery = "";

setupSearch();

try {
  const standings = await loadStandings();
  applyStandings(standings);
  revalidate(standings);
} catch (error) {
  console.error(error);
  updatedAt.textContent = "Unable to load standings.";
  renderError();
}

// Fast path: render the static snapshot served from the same CDN as the
// page. Only fall back to the slower live endpoint if the snapshot is missing.
async function loadStandings() {
  try {
    return ensureValid(await fetchJson(STANDINGS_SNAPSHOT_URL));
  } catch (snapshotError) {
    console.warn("Standings snapshot unavailable; querying live endpoint.", snapshotError);
    return ensureValid(await loadLive());
  }
}

// The snapshot can be a few minutes stale. Once it is on screen, quietly ask
// the live endpoint for fresher numbers and swap them in if they exist.
async function revalidate(current) {
  try {
    const live = ensureValid(await loadLive());
    if (isNewer(live.generatedAt, current.generatedAt)) {
      applyStandings(live);
    }
  } catch (error) {
    console.warn("Live standings refresh failed; keeping snapshot.", error);
  }
}

function applyStandings(standings) {
  updatedAt.textContent = `Updated ${formatDateTime(standings.generatedAt)}`;
  renderStandings(standings.categories);
  applyFilter();
}

// Let a racer find themselves: keep only the rows that match in place, hide the
// rest along with any category that has no match. Filtering happens where the
// rows already are, so the page never jumps and the search box keeps focus as
// more characters are typed. The query persists so a follower's row stays in
// view on return visits and across refreshes.
function setupSearch() {
  if (!searchInput) {
    return;
  }
  try {
    const saved = localStorage.getItem(SEARCH_STORAGE_KEY);
    if (saved) {
      searchInput.value = saved;
      activeQuery = saved.trim().toLowerCase();
    }
  } catch (error) {
    // localStorage can be unavailable (private mode); searching still works.
  }
  searchInput.addEventListener("input", () => {
    activeQuery = searchInput.value.trim().toLowerCase();
    try {
      localStorage.setItem(SEARCH_STORAGE_KEY, searchInput.value);
    } catch (error) {
      // Ignore storage failures; filtering does not depend on persistence.
    }
    applyFilter();
  });
}

function applyFilter() {
  const query = activeQuery;
  tables.classList.toggle("is-filtering", Boolean(query));
  let matchCount = 0;

  tables.querySelectorAll(".table-region").forEach((region) => {
    let regionHasMatch = false;
    region.querySelectorAll("tbody tr").forEach((row) => {
      const match = !query || (row.dataset.search || "").includes(query);
      row.classList.toggle("is-hidden", Boolean(query) && !match);
      if (match) {
        regionHasMatch = true;
        if (query) {
          matchCount += 1;
        }
      }
    });
    region.classList.toggle("is-hidden", Boolean(query) && !regionHasMatch);
  });

  if (searchEmpty) {
    searchEmpty.hidden = !query || matchCount > 0;
  }

  // Hiding rows can change the content-driven width of the frozen Pos/name
  // columns, so re-measure the sticky offsets against what's now visible.
  updateStickyOffsets();
}

function ensureValid(payload) {
  if (!payload || payload.error) {
    throw new Error(payload && payload.error ? payload.error : "Standings response was empty.");
  }
  return payload;
}

function isNewer(candidate, current) {
  const next = Date.parse(candidate);
  const have = Date.parse(current);
  return Number.isFinite(next) && (!Number.isFinite(have) || next > have);
}

function loadLive() {
  if (usesJsonp(STANDINGS_DATA_URL)) {
    return loadJsonp(STANDINGS_DATA_URL);
  }
  return fetchJson(withCacheBust(STANDINGS_DATA_URL));
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load standings: ${response.status}`);
  }
  return response.json();
}

function usesJsonp(url) {
  return /^https:\/\/script\.google\.com\//.test(url);
}

function loadJsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `__critStandings_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out loading standings."));
    }, 10000);

    window[callbackName] = (payload) => {
      cleanup();
      resolve(payload);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Unable to load standings."));
    };
    script.src = withCacheBust(url, { callback: callbackName });
    document.head.append(script);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }
  });
}

function withCacheBust(url, params = {}) {
  const parsed = new URL(url, window.location.href);
  Object.entries(params).forEach(([key, value]) => parsed.searchParams.set(key, value));
  parsed.searchParams.set("cache", Date.now());
  return parsed.toString();
}

function renderStandings(categories) {
  if (categories.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No standings posted yet.";
    tables.replaceChildren(empty);
    return;
  }

  tables.replaceChildren(...categories.map(renderCategory));
  updateStickyOffsets();
}

// The sticky Pos and name columns have content-driven widths, so the second
// name column can't use a hard-coded left offset. Measure the frozen columns
// after layout and expose their widths as CSS variables the stylesheet reads.
// Re-run on resize since column widths shift with the viewport.
function updateStickyOffsets() {
  tables.querySelectorAll(".table-region").forEach((region) => {
    // A hidden region (and any cell inside it) measures as zero width; its
    // offsets get recomputed when the filter clears and it becomes visible.
    if (region.classList.contains("is-hidden")) {
      return;
    }
    // Measure the first *visible* row: filtering can hide the original first
    // row, and a display:none cell reports a width of 0, which would zero the
    // offsets and break the frozen columns.
    const firstRow = region.querySelector("tbody tr:not(.is-hidden)");
    if (!firstRow) {
      return;
    }
    const posWidth = measureWidth(firstRow.querySelector(".pos"));
    const name1Width = measureWidth(firstRow.querySelector(".sticky-col-1"));
    region.style.setProperty("--sticky-col1-left", `${posWidth}px`);
    region.style.setProperty("--sticky-col2-left", `${posWidth + name1Width}px`);
  });
}

function measureWidth(cell) {
  return cell ? cell.getBoundingClientRect().width : 0;
}

window.addEventListener("resize", updateStickyOffsets);

function renderError() {
  const message = document.createElement("p");
  message.className = "empty";
  message.textContent = "Standings are temporarily unavailable.";
  tables.replaceChildren(message);
}

function renderCategory(category) {
  const section = document.createElement("section");
  section.className = "table-region";
  if (category.color) {
    section.style.setProperty("--category-color", category.color);
  }
  if (category.textColor) {
    section.style.setProperty("--category-text-color", category.textColor);
  }

  const heading = document.createElement("h2");
  heading.textContent = category.label;

  const scroller = document.createElement("div");
  scroller.className = "table-scroll";

  const table = document.createElement("table");
  const head = document.createElement("thead");
  const body = document.createElement("tbody");

  const nameHeaders = category.firstNameOnly ? ["First Name"] : ["Last Name", "First Name"];
  // Only weeks that actually have results, in schedule order. Future scheduled
  // weeks with no marks yet are dropped so the table never leads with an empty
  // column tagged "Latest".
  const completed = completedDates(category);
  // Newest race first so the most relevant column is visible without scrolling.
  const displayDates = completed.slice().reverse();
  const latestDate = displayDates[0];
  const movement = computeMovement(category, completed);

  const headerRow = document.createElement("tr");
  appendHeader(headerRow, "Pos", "pos");
  nameHeaders.forEach((label, index) => {
    appendHeader(headerRow, label, `sticky-name sticky-col-${index + 1}`);
  });
  appendHeader(headerRow, "Racer #", "");
  appendHeader(headerRow, "Total", "");
  appendHeader(headerRow, "Vol", "");
  displayDates.forEach((date) => {
    const th = appendHeader(headerRow, date, date === latestDate ? "is-latest" : "");
    if (date === latestDate) {
      const tag = document.createElement("span");
      tag.className = "latest-tag";
      tag.textContent = "Latest";
      th.append(tag);
    }
  });
  head.append(headerRow);

  category.riders.forEach((rider) => {
    const row = document.createElement("tr");
    row.dataset.search = buildSearchKey(rider);

    // Position column: rank plus movement since the previous race.
    const pos = document.createElement("td");
    pos.className = "pos";
    pos.dataset.label = "Pos";
    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = rider.rank;
    pos.append(rank);
    const move = movement.get(rider);
    if (move) {
      const chip = document.createElement("span");
      chip.className = `move move-${move.type}`;
      chip.textContent = move.text;
      pos.append(chip);
    }
    row.append(pos);

    if (!category.firstNameOnly) {
      addCell(row, rider.lastName || "-", "name sticky-name sticky-col-1", "Last Name");
    }
    addCell(
      row,
      `${rider.firstName || rider.displayName}${rider.provisional ? "*" : ""}`,
      category.firstNameOnly ? "name sticky-name sticky-col-1" : "name sticky-name sticky-col-2",
      "First Name"
    );
    addCell(row, rider.raceNumber || "-", "number", "Racer #");
    addCell(row, rider.total, "points total", "Total");
    addCell(row, rider.volunteerDays, "volunteer", "Vol");

    displayDates.forEach((date) => {
      const result = rider.results.find((entry) => entry.date === date);
      addCell(row, result?.value || "-", `race-result${date === latestDate ? " is-latest" : ""}`, date);
    });

    body.append(row);
  });

  table.append(head, body);
  scroller.append(table);
  section.append(heading, scroller);
  return section;
}

// Movement since the previous race, derived from the current standings alone:
// subtract the latest week's points to reconstruct last week's ranking, then
// compare. No historical snapshot needed.
function computeMovement(category, dates) {
  const result = new Map();
  if (dates.length < 2) {
    return result;
  }
  const latest = dates[dates.length - 1];

  const snapshot = category.riders.map((rider) => {
    const latestEntry = rider.results.find((entry) => entry.date === latest);
    const latestPoints = parsePoints(latestEntry && latestEntry.value);
    const racedBefore = rider.results.some(
      (entry) => entry.date !== latest && hasMark(entry.value)
    );
    return { rider, previousTotal: rider.total - latestPoints, racedBefore };
  });

  const ranked = snapshot.slice().sort((a, b) =>
    b.previousTotal - a.previousTotal ||
    a.rider.displayName.localeCompare(b.rider.displayName, "en", { sensitivity: "base" })
  );

  const previousRank = new Map();
  ranked.forEach((item, index) => {
    if (index === 0) {
      previousRank.set(item.rider, 1);
      return;
    }
    const prior = ranked[index - 1];
    const rank = item.previousTotal === prior.previousTotal ? previousRank.get(prior.rider) : index + 1;
    previousRank.set(item.rider, rank);
  });

  snapshot.forEach(({ rider, racedBefore }) => {
    const latestEntry = rider.results.find((entry) => entry.date === latest);
    if (!racedBefore) {
      if (hasMark(latestEntry && latestEntry.value)) {
        result.set(rider, { type: "new", text: "NEW" });
      }
      return;
    }
    const delta = previousRank.get(rider) - rider.rank;
    if (delta > 0) {
      result.set(rider, { type: "up", text: `▲ ${delta}` });
    } else if (delta < 0) {
      result.set(rider, { type: "down", text: `▼ ${Math.abs(delta)}` });
    } else {
      result.set(rider, { type: "same", text: "–" });
    }
  });

  return result;
}

// A week counts as completed once any rider in the category has a mark for it.
// Returned in the category's original schedule order.
function completedDates(category) {
  return category.raceDates.filter((date) =>
    category.riders.some((rider) => {
      const entry = rider.results.find((item) => item.date === date);
      return hasMark(entry && entry.value);
    })
  );
}

function parsePoints(value) {
  const parsed = Number.parseFloat(String(value == null ? "" : value).trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasMark(value) {
  return String(value == null ? "" : value).trim() !== "";
}

function buildSearchKey(rider) {
  return [rider.displayName, rider.firstName, rider.lastName, rider.raceNumber]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function appendHeader(row, label, className) {
  const th = document.createElement("th");
  th.scope = "col";
  if (className) {
    th.className = className;
  }
  th.append(document.createTextNode(label));
  row.append(th);
  return th;
}

function addCell(row, value, className, label) {
  const cell = document.createElement("td");
  cell.className = className;
  if (label) {
    cell.dataset.label = label;
  }
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
