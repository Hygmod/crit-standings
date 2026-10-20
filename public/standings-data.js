// Pure helpers for choosing which standings payload to display.
// Kept free of DOM and network code so they can be unit tested directly.

export function ensureValid(payload) {
  if (!payload || payload.error) {
    throw new Error(payload && payload.error ? payload.error : "Standings response was empty.");
  }
  return payload;
}

// True when `candidate` carries a strictly more recent generatedAt than
// `current`. Used to decide whether a background refresh is worth rendering.
export function isNewer(candidate, current) {
  const next = Date.parse(candidate);
  const have = Date.parse(current);
  return Number.isFinite(next) && (!Number.isFinite(have) || next > have);
}
