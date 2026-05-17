# Airport Crit standings setup

This repo publishes a static standings page for the Chico Cycling Team airport crit page.
The Google Sheet stays private. A Google Apps Script web app runs as the Sheet owner, reads the Sheet at request time, and returns public JSON to the static GitHub Pages frontend.

## One-time Google Apps Script setup

These steps happen outside this repo because they require your Google account and the private standings Sheet.

1. Install clasp if you do not already have it:

   ```sh
   npm install @google/clasp -g
   ```

2. Enable the Apps Script API for your Google account at:

   ```text
   https://script.google.com/home/usersettings
   ```

3. Log in with the Google account that owns or can edit the standings Sheet:

   ```sh
   clasp login
   ```

4. In the standings Sheet, open Extensions > Apps Script. Create the bound script project there and rename it to `Crit Standings Web App`.

5. In the Apps Script editor, open Project Settings and copy the Script ID.

6. Copy `.clasp.example.json` to `.clasp.json`, replace `PASTE_SCRIPT_ID_HERE` with the real Script ID, and keep `"rootDir": "apps-script"`.

7. Commit `.clasp.json` after it contains the real `scriptId`; it is safe to commit. Do not commit `.clasprc.json`; that OAuth token is ignored by git.

8. Upload the repo source to Apps Script:

   ```sh
   clasp push
   ```

9. Open the script editor and run `doGet` once from the editor. Approve the requested Sheet access.

10. Deploy the web app:

   ```sh
   clasp version "Initial web app"
   clasp deploy <version> "Initial web app"
   ```

   In the Apps Script deployment UI, confirm the deployment is a Web app, executes as you, and allows anyone to access it.

11. Copy the deployed `/exec` URL. Do not use the `/dev` test URL for the public site.

12. Replace `STANDINGS_DATA_URL` in `public/config.js` with the `/exec` URL and commit that change.

For later Apps Script changes, `clasp push` runs automatically (see "Automated Apps Script deploys" below). To make the change live, keep the same deployment ID so the public URL does not change:

```sh
clasp deployments
clasp redeploy <deploymentId> <version> "Describe the change"
```

## One-time GitHub setup

In `Hygmod/crit-standings`:

1. Enable GitHub Pages with source set to GitHub Actions.
2. Run the `Deploy standings` workflow manually once after `public/config.js` contains the real Apps Script `/exec` URL.
3. Add a `CLASPRC_JSON` repository secret so the `Deploy Apps Script` workflow can authenticate (see below).

The `Deploy standings` workflow deploys only static files from `public/`. It does not read the private Sheet and it has no schedule.

## Automated Apps Script deploys

The `Deploy Apps Script` workflow (`.github/workflows/deploy-apps-script.yml`) runs `clasp push` whenever `apps-script/**` or `.clasp.json` changes on `main`, and can also be triggered manually. It needs the clasp OAuth credentials.

1. On a machine where you have run `clasp login`, open `~/.clasprc.json`.
2. In `Hygmod/crit-standings`, go to Settings > Secrets and variables > Actions and add a repository secret named `CLASPRC_JSON` with the full contents of that file as the value.
3. Make sure the Apps Script API is enabled for that Google account at `https://script.google.com/home/usersettings`.

Treat `CLASPRC_JSON` like a password: it grants clasp access to your Apps Script projects. If `clasp push` later fails with an auth error, run `clasp login` again locally and update the secret.

The workflow pushes the script source only. It does not create a new web app version, so the public `/exec` URL keeps serving the previously deployed version until you redeploy.

## Weebly link

After the first successful Pages deploy, point the existing `2026 Crit Standings` button on `airport-crit.html` to:

```text
https://hygmod.github.io/crit-standings/
```

The standings page links back to the Chico Cycling Team airport crit page:

```text
https://www.chicocyclingteam.org/airport-crit.html
```

The Weebly page should not need edits after that unless the linked standings URL changes.

## Public-data rules

- Public categories: Cat 1/2/3, A's, B's, Women, Masters, Kids.
- Categories are published only after at least one rider has a points result recorded.
- Adult categories show first name, last name, racer number, points, volunteer count, and race results.
- Kids show first name, racer number, points, volunteer count, and race results.
- Adult riders with fewer than two volunteer days show an asterisk. Kids are exempt from the volunteer requirement and never show an asterisk.
