# Expo

When working in `app/`, read https://docs.expo.dev/versions/v57.0.0/ before
writing code. The API has changed, do not rely on what you remember.

# Generated types

`server/openapi.json` and `app/src/generated/api.d.ts` are generated. Never
edit them by hand. Change the Zod schemas in
`server/src/<feature>/<feature>.dto.ts`, then from `server/` run
`npm run types:gen`, and `npm run types:check` to verify sync.

# Scripts

`server/`

- `npm run dev` — Fastify on :3000 with watch, Swagger UI at /docs.
- `npm run check` — Prettier and TypeScript.
- `npm test` — integration tests against booking_test on :5434. Needs `db:up`.
- `npm run db:up` — Postgres in Docker, dev on :5433 and test on :5434.

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

# Rules

- The server owns the booking rules. The client renders what it is told.
- Fix the cause, not the symptom. Investigate before patching.
- Verify before claiming, read the file or run the command.
- Reuse existing helpers and components. Search before writing a new one.
- Names and structure carry the meaning, not comments.
- drizzle/ is .gitignored as of now during development, no need to bring it up.
