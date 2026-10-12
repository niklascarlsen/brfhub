# Expo

When working in `app/`, read the SDK page for the module you are touching
before writing code: `https://docs.expo.dev/versions/v57.0.0/sdk/<module>/`.
The version index alone answers nothing. The API has changed, do not rely on
what you remember.

# Generated types

`server/openapi.json`, `app/src/generated/api.d.ts` and
`web/src/generated/api.d.ts` are generated. Never edit them by hand. Change the
Zod schemas in `server/src/<feature>/<feature>.dto.ts`, then from `server/` run
`npm run types:gen`, and `npm run types:check` to verify sync.

`web/src/theme.css`, `web/src/components/icons/` and the theme-color meta tag
in `web/index.html` are generated from `app/src/theme.json` and the `ionicons`
package: change colours or glyphs there and both clients follow. The generated
files are committed; `npm run generate` in `web/` rewrites them, and `dev`,
`build` and `check` run it first, so commit what it produces.

# Scripts

`server/`

- `npm run dev` — Fastify on :3000 with watch, Swagger UI at /docs.
- `npm run check` — Prettier, TypeScript and the generated-types sync
  (regenerates and diffs, so it fails on uncommitted type changes).
- `npm test` — integration tests against booking_test on :5434. Needs `db:up`.
  It drops and re-pushes the test schema every run, since `drizzle-kit push`
  silently keeps the old schema there when it wants to prompt.
- `npm run db:up` — Postgres in Docker, dev on :5433 and test on :5434.
- `npm run db:seed` — resets bookings, subscriptions, resources, accounts,
  announcements and settings of the two seeded organizations; others, such
  as ones made with `org:create`, are left alone. Brf Exempel signs in as
  `<number>@example.com`, Brf Andra as `<number>@andra.example.com`, and each
  admin as `admin@` on the same domain, all with password `password`. Brf
  Andra keeps New York time and English alone, to see another time zone and
  a one-language organization with real data. Members
  and push tokens survive, so the app stays registered. It wipes bookings I
  may be testing with, so ask before running it.
- `npm run org:create -- --id <slug> --name <name> --time-zone <IANA zone>
--admin-email <email> [--languages sv,en]`: creates an organization and
  its one admin, and prints the password once. The time zone cannot be
  changed afterwards; the languages, Swedish by default, can.
- `npm run push:test -- [organization] [apartment]`: releases an upcoming
  booking held by another apartment and sends the real notification to the
  watching apartment, `demo` and `12` by default. Reseed when it runs out of
  bookings.

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

Physical iPhone with a free Apple ID (no paid developer account):

- `npx expo run:ios --device`, with Metro running. `ios/` is regenerated, so
  signing lives in `app.config.ts`: `APPLE_PERSONAL_TEAM=<team id>` in
  `app/.env` sets the team and strips the push entitlement a personal team
  cannot sign. The push token warning that follows is expected.
- "No profiles found": Expo does not pass `-allowProvisioningUpdates`. Run
  `xcodebuild -workspace ios/booking.xcworkspace -scheme booking -destination
id=<udid> -allowProvisioningUpdates build` once. The free profile expires
  after 7 days, then repeat.
- The phone must be unlocked, trust the developer under Settings, General,
  VPN & Device Management, and allow local network access.
- "No script URL provided" means Metro is down or the app was opened without
  its URL: `bookslot://expo-development-client/?url=http%3A%2F%2F<mac ip>%3A8081`.
- After an Xcode update `xcrun` fails with code 69 until the user runs
  `sudo xcodebuild -license accept && sudo xcodebuild -runFirstLaunch`. A
  codesign keychain password prompt the user cannot answer means a
  certificate Xcode did not create: delete it in Keychain Access and let
  `-allowProvisioningUpdates` create a new one.

`web/`

- `npm run dev` — Vite on :5173. Reads the API from `VITE_API_URL`, default
  http://localhost:3000.
- `npm run build` — typecheck and production build into `dist/`. The routes
  are real paths, so whatever serves `dist/` has to rewrite unknown paths to
  `index.html`. `dev` and `preview` already do, which is why a missing
  rewrite only shows up once it is deployed.
- `npm run generate` — rewrites the generated theme and icons, see Generated
  types. Runs by itself before `dev`, `build` and `check`.
- `npm run check` — Prettier, TypeScript, ESLint and a diff of the files
  shared with the app (`src/lib/dates.ts`, `src/admin/localized.ts`, and
  `sv.ts`, `en.ts` and `catalog.ts` in `src/i18n/`) against the app's
  copies.

I keep the `server/` and `web/` dev servers running while testing. Never kill
them (`pkill`, by port); check what is listening with
`lsof -tiTCP:<port> -sTCP:LISTEN` and reuse it. Vite HMR and `tsx watch`
pick up changes without a restart.

# Clients

- The server owns the booking rules. The client renders what it is told.
- An account is an apartment (`role: member`) or its organization's one
  admin, and the organization always comes from the account. `AccountGate`
  in `src/auth/account.tsx` picks the app; the admin app mounts no booking
  screens or push.
- `web/` is one app. Below 1024px it renders the same screens as `app/`; above
  it renders the calendar and day view in `src/desktop/`, which loads the whole
  booking window for every resource in one `/schedule` request.
- `src/lib/dates.ts` is the same file in both clients, kept honest by web's
  `shared:check`. Its tests live in `app/`, so add helpers there. What only the
  desktop calendar needs goes in `web/src/desktop/weeks.ts`.
- Every visible string lives in `src/i18n/sv.ts` and `src/i18n/en.ts`, the
  same files in both clients and checked by `shared:check`. A new string goes
  in both, and TypeScript refuses an English catalog that lacks a Swedish key.
  Components read it with `useMessages()`; helpers outside components take it
  as a `t: Messages` argument. Never write UI text inline.
- The organization picks its languages (`locales`), and the clients show
  only those. Its own text (resource and kind names, tags, rules,
  announcements) is jsonb with a value per language. The server resolves it
  from `Accept-Language`, so member endpoints return plain strings and admin
  endpoints the whole object (`server/src/lib/locale.ts`). Untranslated text
  falls back to a language it is written in.
- The language is per device: the one picked under Lägenhet or Föreningen,
  else the first device language the organization uses, else English if it
  uses it. Push tokens carry it, and the server writes push in it.
- `web/` is on Tailwind v4 (CSS-first, tokens in `@theme`); `app/` stays on the
  v3 LTS that NativeWind needs. Do not copy config between them.
- Match the app's result, not its layout mechanism. Anything sized from the
  viewport in React Native is wrong on web, where one breakpoint spans phone to
  laptop.
- Keep the clients symmetric. No hook or helper file in one client unless the
  other gets the same shape. Short logic stays inline in the component.
- Data loading is hand-rolled. Never add TanStack Query, SWR or another
  server-state library.
- Layout that depends on the mobile viewport (`dvh`/`vh`, fixed bottom bars,
  safe areas) cannot be verified in desktop Chrome, nor by a script that fakes
  a width, since the toolbar never collapses there. Prefer designs without viewport
  units; otherwise report it as unverified and needing a real phone, and do not
  call it verified.
- If web push shows as Chrome instead of Boka on macOS, that is Chrome's
  `AppShimNotificationAttribution` feature flag, not our code. Do not touch
  `push-sw.js` or the manifest for it.

# Rules

- Reuse existing helpers and components. Search before writing a new one.
- In `app/` and `web/`, import with the `@/` alias, never `../`. `server/` has
  no alias and uses relative imports.
- drizzle/ is .gitignored as of now during development, no need to bring it up.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
