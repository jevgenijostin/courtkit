# CourtKit

A small browser tournament desk for pickleball or padel clubs. Enter 4–12 fixed doubles teams and 1–4 courts to create a round robin where every team plays every other team once. Built with TypeScript, Vite, and plain CSS; no framework or backend.

## Run locally

Install a current Node.js LTS release and run:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. For a production build, run `npm run build`; serve the resulting `dist` directory with a static web server (or use `npx vite preview` locally).

## Run a tournament

1. Enter one team name per line, choose the court count, and select **Create tournament**.
2. Record each match's home and away scores with **Save result**. Scores must be nonnegative whole numbers with a winner. Saved results can be edited.
3. Move through rounds with **Previous round** and **Next round**. All idle teams are listed as byes, including teams waiting because court capacity is limited.
4. Follow the standings, ranked by wins and then point difference. Teams tied on both share a rank.
5. Use **Print scorecards** (or the browser print command) to print blank scorecards for every scheduled match plus the current standings.

Teams, schedule, and saved scores persist automatically in this browser's localStorage. Refresh resumes at the first round with an unrecorded match. Unsaved input is not persisted. Keep the same browser and site address to access the saved tournament.

**Export backup** downloads a validated JSON file. **Import backup** restores one from either screen and asks before replacing an active tournament. **New tournament** asks before deleting the current saved tournament. Storage or import failures are shown on screen; a failed save does not replace the current state.

Tournament operations run locally after the page loads. Back up before clearing browser data. Installation and reliable offline page reloads via a service worker are not implemented yet.

## Tests

```sh
npm run test
npx playwright install chromium
npm run test:e2e
```

Unit tests cover scheduling, standings, and storage validation. The Chromium end-to-end test builds and serves the production app, creates a tournament, records and edits a result, checks standings and refresh persistence, verifies print visibility, and exercises backup export/import and reset confirmation.

`npm run build` checks TypeScript and produces the production bundle. Playwright starts its own preview server on port 4173; leave that port free.
