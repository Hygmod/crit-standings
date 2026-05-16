# Crit standings

Static standings page for the 2026 Chico Airport Criterium.

The source Google Sheet remains private. A scheduled GitHub Actions workflow reads it with a Google service account, generates `public/data/standings.json`, and deploys the `public/` folder to GitHub Pages. The Chico Cycling Team Weebly page can link to the published standings page from the existing Crit Standings button.

## Local development

```sh
npm install
npm test
```

To generate live standings locally, set:

- `GOOGLE_SERVICE_ACCOUNT_JSON`: full Google service account JSON with viewer access to the Sheet
- `GOOGLE_SHEET_ID`: optional override; defaults to the 2026 Airport Crit Roster Sheet

Then run:

```sh
npm run build:data
```

See [docs/setup.md](docs/setup.md) for the production setup and Weebly link.
