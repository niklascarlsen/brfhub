# Expo

When working in `app/`, read https://docs.expo.dev/versions/v57.0.0/ before
writing code. The API has changed, do not rely on what you remember.

# Generated types

`server/openapi.json`, `app/src/generated/api.d.ts` and
`web/src/generated/api.d.ts` are generated. Never edit them by hand. Change the
Zod schemas in `server/src/<feature>/<feature>.dto.ts`, then from `server/` run
`npm run types:gen`, and `npm run types:check` to verify sync.

`web/src/theme.css`, `web/src/components/icons/` and the theme-color meta tag
in `web/index.html` are generated from `app/src/theme.json` and the `ionicons`
package: change colours or glyphs there and both clients follow. The two
generated paths are gitignored; `npm run generate` in `web/` rewrites them,
and `dev`, `build` and `check` run it first, which is how a fresh clone works
without those files in git.

# Scripts

`server/`

- `npm run dev` — Fastify on :3000 with watch, Swagger UI at /docs.
- `npm run check` — Prettier, TypeScript and the generated-types sync
  (regenerates and diffs, so it fails on uncommitted type changes).
- `npm test` — integration tests against booking_test on :5434. Needs `db:up`.
- `npm run db:up` — Postgres in Docker, dev on :5433 and test on :5434.
- `npm run db:seed` — resets bookings, subscriptions, resources and accounts
  to a known state. Every apartment signs in as `<number>@example.com` with
  password `password`. Members and push tokens survive, so the app stays
  registered.
- `npm run push:test` — releases an upcoming booking held by another apartment
  and sends the real notification. Reseed when it runs out of bookings.

`app/`

- `npm run android` / `npm run ios` — build, install and start Metro. Saving a
  file then reloads the app by itself. Rerun only after changes to `app.json`
  or a package with native code.
- `npm start` — start Metro alone, when the app is installed but Metro is not
  running.
- `npm run go` — Expo Go on a physical iPhone. UI only: push does not work
  there, and it throws on Android.
- `npm run check` — Prettier, TypeScript and ESLint.
- `npm test` — Jest via `jest-expo`, run in Europe/Stockholm and then
  America/New_York. The date helpers use local time, and only a negative
  offset catches a zone bug. Setting TZ inside a test does nothing.

`web/`

- `npm run dev` — Vite on :5173. Reads the API from `VITE_API_URL`, default
  http://localhost:3000.
- `npm run build` — typecheck and production build into `dist/`. The routes
  are real paths, so whatever serves `dist/` has to rewrite unknown paths to
  `index.html`. `dev` and `preview` already do, which is why a missing
  rewrite only shows up once it is deployed.
- `npm run generate` — rewrites the generated theme and icons, see Generated
  types. Runs by itself before `dev`, `build` and `check`.
- `npm run check` — Prettier, TypeScript, ESLint and a diff of
  `src/lib/dates.ts` against the app's copy.

# Clients

- The server owns the booking rules. The client renders what it is told.
- `web/` is one app. Below 1024px it renders the same screens as `app/`; above
  it renders the week grid in `src/desktop/`.
- `src/lib/dates.ts` is the same file in both clients, kept honest by web's
  `dates:check`. Its tests live in `app/`, so add helpers there. What only the
  week grid needs goes in `web/src/desktop/weeks.ts`.
- `web/` is on Tailwind v4 (CSS-first, tokens in `@theme`); `app/` stays on the
  v3 LTS that NativeWind needs. Do not copy config between them.
- Match the app's result, not its layout mechanism. Anything sized from the
  viewport in React Native is wrong on web, where one breakpoint spans phone to
  laptop.

# Rules

- Fix the cause, not the symptom. Investigate before patching.
- Verify before claiming, read the file or run the command.
- Reuse existing helpers and components. Search before writing a new one.
- Import with the `@/` alias, never `../`.
- Names and structure carry the meaning, not comments.
- drizzle/ is .gitignored as of now during development, no need to bring it up.
