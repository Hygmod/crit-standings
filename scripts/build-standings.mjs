import { mkdir, writeFile } from "node:fs/promises";
import { createSign } from "node:crypto";
import { dirname, resolve } from "node:path";
import { CATEGORY_CONFIG, buildStandings } from "../src/standings.js";

const spreadsheetId = process.env.GOOGLE_SHEET_ID?.trim() || "1ai6-jlUnUMPKYzpxT1WLkY0tlkkHIxASapgZF2WH1vw";
const outputPath = resolve(process.env.STANDINGS_OUTPUT ?? "public/data/standings.json");

const credentials = parseCredentials(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
const accessToken = await getAccessToken(credentials);
const response = await fetchSheetValues(accessToken);

const valuesBySheet = Object.fromEntries(
  (response.valueRanges ?? []).map((range, index) => [
    CATEGORY_CONFIG[index].sheetName,
    range.values ?? []
  ])
);

const standings = buildStandings(valuesBySheet);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(standings, null, 2)}\n`, "utf8");
console.log(`Wrote ${outputPath}`);

function parseCredentials(rawCredentials) {
  if (!rawCredentials) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is required to read the private Sheet.");
  }

  const credentials = JSON.parse(rawCredentials);
  if (typeof credentials.private_key === "string") {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }
  return credentials;
}

async function getAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };
  const assertion = signJwt(header, claim, credentials.private_key);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    throw new Error(`Google OAuth failed: ${response.status} ${await response.text()}`);
  }

  const token = await response.json();
  return token.access_token;
}

async function fetchSheetValues(accessToken) {
  const params = new URLSearchParams({ valueRenderOption: "FORMATTED_VALUE" });
  CATEGORY_CONFIG.forEach((config) => {
    params.append("ranges", `${quoteSheetName(config.sheetName)}!A1:U1000`);
  });

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${params}`,
    { headers: { authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Google Sheets read failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

function signJwt(header, claim, privateKey) {
  const input = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(input);
  signer.end();
  return `${input}.${signer.sign(privateKey).toString("base64url")}`;
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function quoteSheetName(name) {
  return `'${name.replace(/'/g, "''")}'`;
}
