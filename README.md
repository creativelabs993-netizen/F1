# F1 Comeback Index

A historical Formula 1 grid-to-finish analysis: compare each driver's official starting grid position with their final official race classification, then rank the biggest position gains.

## Included

- `public/greatest-comebacks.html` — responsive dark broadcast-style page with filters, leaderboard, slope chart, replay controls and 16:9 video mode.
- `public/greatest-comebacks.js` — archive loader, ranking and visualization logic.
- `api/last-lap-swings.js` — public API route that reads cached season results from Postgres or imports them from the Jolpica-F1 Ergast-compatible API.
- `migrations/` — table and schema migrations required by the API.
- `public/theme.css` — shared site theme referenced by the page.

## Data methodology

Position gain = numeric official grid position − numeric final classification position. The default view includes classified finishers. The page can also show other official numeric classifications. Pit-lane/no-grid starters and the Indianapolis 500 are excluded. The source is the Jolpica-F1 Ergast-compatible results API.

The source project currently has historical records for 1950–2026. Those live Postgres rows are **not** stored in this Git repository; the API repopulates the cache season by season when deployed with the database migrations.

## Run on Hatchable

This is a Hatchable-native project slice, not a standalone Node/Express app.

1. Create or open a Hatchable project.
2. Copy the `public/`, `api/`, and `migrations/` files into the matching project paths.
3. Deploy so the SQL migrations are applied.
4. Open `/greatest-comebacks.html`. The page requests `/api/last-lap-swings?year=YYYY` for each season from 1950 through the current year.

The API uses the Hatchable SDK's `db.query` and therefore requires the Hatchable runtime and Postgres database. No API key is needed for the public Jolpica-F1 results feed.

## Source project

Built as part of F1 Unlimited: https://f1-live-race-hub.hatchable.site/greatest-comebacks.html
