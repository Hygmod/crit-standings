import { STANDINGS_DATA_URL, STANDINGS_SNAPSHOT_URL } from "./config.js";

const updatedAt = document.querySelector("#updated-at");
const tables = document.querySelector("#standings-tables");

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
}

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
