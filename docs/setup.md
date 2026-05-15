# Airport Crit standings setup

This repo publishes a static standings widget for the Chico Cycling Team airport crit page.
The Google Sheet stays private; GitHub Actions reads it with a Google service account and deploys only the generated public standings data to GitHub Pages.

## One-time Google setup

1. Create or choose a Google Cloud project.
2. Enable the Google Sheets API.
3. Create a service account.
4. Create a JSON key for that service account.
5. Share the private standings Sheet with the service account email as a viewer.

## One-time GitHub setup

In `Hygmod/crit-standings`:

1. Add repository secret `GOOGLE_SERVICE_ACCOUNT_JSON` with the full service account key JSON.
2. Add repository variable `SPREADSHEET_ID` with `1ai6-jlUnUMPKYzpxT1WLkY0tlkkHIxASapgZF2WH1vw`.
3. Enable GitHub Pages with source set to GitHub Actions.
4. Run the `Deploy standings` workflow manually once.

The workflow also runs every 15 minutes.

## Weebly embed

After the first successful Pages deploy, add an Embed Code block on `airport-crit.html`:

```html
<iframe
  src="https://hygmod.github.io/crit-standings/"
  title="2026 Chico Airport Crit standings"
  style="width:100%;min-height:760px;border:0;"
  loading="lazy"
></iframe>
```

The Weebly page should not need edits after that unless the embed location or styling changes.

## Public-data rules

- Public categories: Cat 1/2/3, A's, B's, Women, Masters, Kids.
- Adult categories show first name, last name, racer number, points, volunteer count, and race results.
- Kids show first name, racer number, points, volunteer count, and race results.
- Riders with fewer than two volunteer days show an asterisk.
