# Crit standings

Static standings page for the 2026 Chico Airport Criterium.

The source Google Sheet remains private. A Google Apps Script web app, bound to the Sheet and deployed as the Sheet owner, reads the standings live and returns public JSON. The Chico Cycling Team Weebly page can link to the published standings page from the existing Crit Standings button.

To keep the page fast, a scheduled `Snapshot standings` workflow fetches that JSON every 15 minutes and publishes it as a static file (`public/data/standings.json`). Visitors load that snapshot instantly from the GitHub Pages CDN, and the page revalidates against the live endpoint in the background so fresher numbers still appear without blocking the initial render.

## Local development

```sh
npm install
npm test
```

The page loads the published `public/data/standings.json` snapshot first and falls back to the live Apps Script endpoint when that file is missing (for example, before the first snapshot runs). `public/data/standings.sample.json` is a reference for the JSON shape.

See [docs/setup.md](docs/setup.md) for the Apps Script, clasp, GitHub Pages, and Weebly setup steps.
