# Crit standings

Static standings page for the 2026 Chico Airport Criterium.

The source Google Sheet remains private. A Google Apps Script web app, bound to the Sheet and deployed as the Sheet owner, reads the standings live and returns public JSON for the static GitHub Pages frontend. The Chico Cycling Team Weebly page can link to the published standings page from the existing Crit Standings button.

## Local development

```sh
npm install
npm test
```

The local frontend uses `public/data/standings.sample.json` until the Apps Script `/exec` URL is deployed and recorded in `public/config.js`.

See [docs/setup.md](docs/setup.md) for the Apps Script, clasp, GitHub Pages, and Weebly setup steps.
