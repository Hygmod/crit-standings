var STANDINGS_CACHE_KEY = "standings-json-v1";
var STANDINGS_CACHE_SECONDS = 60;

function doGet(e) {
  try {
    return createJsonOutput_(getStandingsJson_(), e);
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return createJsonOutput_(JSON.stringify({
      error: "Standings are temporarily unavailable."
    }));
  }
}

function getStandingsJson_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(STANDINGS_CACHE_KEY);
  if (cached) {
    return cached;
  }

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error("This Apps Script must be bound to the standings Google Sheet.");
  }

  var valuesBySheet = {};
  CATEGORY_CONFIG.forEach(function(config) {
    var sheet = spreadsheet.getSheetByName(config.sheetName);
    valuesBySheet[config.sheetName] = sheet ? getDisplayValues_(sheet) : [];
  });

  var json = JSON.stringify(buildStandings(valuesBySheet));
  try {
    cache.put(STANDINGS_CACHE_KEY, json, STANDINGS_CACHE_SECONDS);
  } catch (error) {
    // CacheService has a per-entry size limit; the live response should still work without it.
  }
  return json;
}

function getDisplayValues_(sheet) {
  var rowCount = Math.max(sheet.getLastRow(), 4);
  var columnCount = Math.max(sheet.getLastColumn(), 5);
  return sheet.getRange(1, 1, rowCount, columnCount).getDisplayValues();
}

function createJsonOutput_(json, e) {
  var callback = getJsonpCallback_(e);
  var output = callback ? callback + "(" + json + ");" : json;
  return ContentService
    .createTextOutput(output)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function getJsonpCallback_(e) {
  var params = e && e.parameter ? e.parameter : {};
  var callback = params.callback || params.prefix || "";
  if (!callback) {
    return "";
  }
  if (!/^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback)) {
    throw new Error("Invalid JSONP callback.");
  }
  return callback;
}
