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
   clasp deploy -d "Initial web app"
   ```

   In the Apps Script deployment UI, confirm the deployment is a Web app, executes as you, and allows anyone to access it.

11. Copy the deployed `/exec` URL. Do not use the `/dev` test URL for the public site.

12. Replace `STANDINGS_DATA_URL` in `public/config.js` with the `/exec` URL and commit that change.

13. Record the deployment ID for automated deploys:

   ```sh
   clasp list-deployments
   ```

   Copy the ID of the deployment that serves the `/exec` URL above (not the `@HEAD` test deployment). It is needed for the `APPS_SCRIPT_DEPLOYMENT_ID` GitHub variable below.

After this one-time setup, later Apps Script changes are fully automated: merging a change to `apps-script/**` on `main` runs `clasp push` and redeploys the same deployment ID, so the public `/exec` URL stays the same and serves the new code (see "Automated Apps Script deploys" below).

## One-time GitHub setup

In `Hygmod/crit-standings`:

1. Enable GitHub Pages with source set to GitHub Actions.
2. Run the `Deploy standings` workflow manually once after `public/config.js` contains the real Apps Script `/exec` URL.
3. Run the `Snapshot standings` workflow manually once so the first `public/data/standings.json` snapshot exists. After that it runs automatically on a schedule.
4. Add the `CLASPRC_JSON` secret and `APPS_SCRIPT_DEPLOYMENT_ID` variable so the `Deploy Apps Script` workflow can authenticate and redeploy (see below).

The `Deploy standings` workflow deploys only static files from `public/`. It does not read the private Sheet and it has no schedule.

## Standings snapshot

`Snapshot standings` (`.github/workflows/snapshot-standings.yml`) is what keeps the page fast. Every 15 minutes (and on demand) it fetches the public `/exec` JSON, validates it, and commits the result to `public/data/standings.json`, then deploys Pages when the snapshot changed.

The frontend loads that static snapshot first, so the page paints immediately from the CDN instead of waiting on a live Google Sheet read. It then revalidates against the live `/exec` endpoint in the background and swaps in fresher numbers if any exist, so results stay current between snapshots without blocking the initial load.

The workflow only reads the already-public `/exec` JSON, so it needs no extra secrets. If `public/data/standings.json` is ever missing, the page falls back to the live endpoint automatically.

## Automated Apps Script deploys

The `Deploy Apps Script` workflow (`.github/workflows/deploy-apps-script.yml`) runs whenever `apps-script/**` or `.clasp.json` changes on `main`, and can also be triggered manually. It runs the tests, then `clasp push`, then redeploys the web app so the public `/exec` URL serves the new code.

It needs two settings under Settings > Secrets and variables > Actions in `Hygmod/crit-standings`:

1. Secret `CLASPRC_JSON`: on a machine where you have run `clasp login`, copy the full contents of `~/.clasprc.json` into a new repository secret with this name.
2. Variable `APPS_SCRIPT_DEPLOYMENT_ID`: the deployment ID recorded in step 13 of the Apps Script setup. This is a repository variable, not a secret.

Also make sure the Apps Script API is enabled for that Google account at `https://script.google.com/home/usersettings`.

Treat `CLASPRC_JSON` like a password: it grants clasp access to your Apps Script projects. If a deploy fails with an auth error, run `clasp login` again locally and update the secret.

The workflow always redeploys the same deployment ID, so the public `/exec` URL never changes. Do not create a new deployment for routine changes; that would produce a new URL and break `public/config.js`.

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
