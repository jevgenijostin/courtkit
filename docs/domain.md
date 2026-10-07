# Core domain (chunk 1)

Run `npm install`, `npm test`, and `npm run build`. `npm run dev` serves the
empty browser entry point; the UI belongs to a later chunk. Node 24 is used for
development. All domain operations run locally and require no network services.

- `generateSchedule(teams, courtCount)` accepts 4–12 fixed-partner teams and
  1–4 courts. IDs must be unique; display names need not be. The circle method
  generates each pairing once, then splits pairing sets into simultaneous time
  slots that fit the courts. Each slot lists all idle teams as byes. Courts and
  rounds start at 1. Output is deterministic and inputs are not mutated. Rest
  spacing, home/away balance, and minimum total time slots are not optimized.
- `computeStandings(teams, schedule, results)` counts only completed matches.
  Scores are nonnegative safe integers with a winner; there is no fixed target
  score. Unplayed matches have no result. Wins sort first, then point
  differential. Equal teams retain input order and share competition ranks
  (1, 1, 3), without a hidden tiebreaker.
- `TournamentState` stores schema version 1, teams, court count, a complete
  schedule, and zero or more results. Draft/unscheduled tournaments are not yet
  a persisted state. IDs connect results to matches and matches to teams.
- `saveTournament` / `loadTournament` use `courtkit:tournament:v1` in
  `localStorage`. An optional storage adapter makes testing possible without a
  browser. A missing save returns `null`; corrupt saves and storage access/quota
  failures throw. Invalid state is rejected before writing.
- `exportToJson` / `importFromJson` provide versioned backup strings. Import
  validates exact fields, types, schedule completeness, court/team exclusivity,
  byes, and result references. Unknown fields/versions are rejected rather than
  silently discarded. Future schema changes need an explicit migration.

UI, score entry screens, printing, file download/upload controls, service worker
installation/offline asset caching, and tournament editing are deferred.
