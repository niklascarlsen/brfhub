# Expo

When working in `app/`, read the SDK page for the module you are touching before writing code: `https://docs.expo.dev/versions/v57.0.0/sdk/<module>/`. The version index alone answers nothing. The API has changed, do not rely on what you remember.

# Generated types

`server/openapi.json`, `core/src/generated/api.d.ts` and `core/src/generated/limits.ts` are generated. Never edit them by hand. Change the Zod schemas in `server/src/<feature>/<feature>.dto.ts`, then from `server/` run `npm run types:gen`, and `npm run types:check` to verify sync.

`limits.ts` is the server's limits copied out for the clients: each one is set in the Zod schema next to its field (Better Auth's password rule in `server/src/auth/auth.ts`), and the admin forms read the copy through the checks in `core/src/admin/drafts.ts`. To change a limit, change the schema and run `types:gen`.

`web/src/theme.css`, `web/src/components/icons/` and the theme-color meta tag in `web/index.html` are generated from `app/src/theme.json` and the `ionicons` package: change colours or glyphs there and both clients follow. The generated files are committed; `npm run generate` in `web/` rewrites them, and `dev`, `build` and `check` run it first, so commit what it produces.

# Scripts

The root is an npm workspace of `core/`, `app/` and `web/` with one lockfile: run `npm install` there, never inside them. `server/` stays outside with its own.

Root

- `npm run check`: Prettier on the root's own files, `check` in every workspace, then `scripts/check-mirrors.mjs`.
- `npm test`: core's tests (Vitest), run in Europe/Stockholm and then America/New_York. The date helpers use local time, and only a negative offset catches a zone bug. Setting TZ inside a test does nothing.

`server/`

- `npm run dev` — Fastify on :3000 with watch, Swagger UI at /docs.
- `npm run check` — Prettier, TypeScript and the generated-types sync (regenerates and diffs, so it fails on uncommitted type changes).
- `npm test` — integration tests against booking_test on :5434. Needs `db:up`. It drops and re-pushes the test schema every run, since `drizzle-kit push` silently keeps the old schema there when it wants to prompt.
- `npm run db:up` — Postgres in Docker, dev on :5433 and test on :5434, and Mailpit, which catches every mail the dev server sends: read them at http://localhost:8025, or fetch the newest with `curl -s 'http://localhost:8025/api/v1/search?query=to:12@example.com' | jq -r '.messages[0].Snippet'`.
- `npm run db:seed` — resets bookings, subscriptions, resources, accounts, announcements and settings of the two seeded organizations; others, such as ones made with `org:create`, are left alone. Apartments sign in with the code mailed to them: Brf Exempel as `<number>@example.com`, Brf Andra as `<number>@andra.example.com`. Each admin signs in as `admin@` on the same domain with password `password`, and so does `styrelse@example.com`, who lives in apartment 31 of Brf Exempel and is both. Brf Andra keeps New York time and English alone, to see another time zone and a one-language organization with real data. Members and push tokens survive, so the app stays registered. It wipes bookings I may be testing with, so ask before running it.
- `npm run org:create -- --id <slug> --name <name> --time-zone <IANA zone> --admin-email <email> [--languages sv,en]`: creates an organization and its first admin, and prints the password once. The time zone cannot be changed afterwards; the languages, Swedish by default, can.
- `npm run push:test -- [organization] [apartment]`: releases an upcoming booking held by another apartment and sends the real notification to the watching apartment, `demo` and `12` by default. Reseed when it runs out of bookings.

`app/`

- `npm run android` / `npm run ios` — build, install and start Metro. Saving a file then reloads the app by itself. Rerun only after changes to `app.json` or a package with native code.
- `npm start` — start Metro alone, when the app is installed but Metro is not running.
- `npm run go` — Expo Go on a physical iPhone. UI only: push does not work there, and it throws on Android.
- `npm run check` — Prettier, TypeScript and ESLint.

Physical iPhone with a free Apple ID (no paid developer account):

- `npx expo run:ios --device`, with Metro running. `ios/` is regenerated, so signing lives in `app.config.ts`: `APPLE_PERSONAL_TEAM=<team id>` in `app/.env` sets the team and strips the push entitlement a personal team cannot sign. The push token warning that follows is expected.
- "No profiles found": Expo does not pass `-allowProvisioningUpdates`. Run `xcodebuild -workspace ios/booking.xcworkspace -scheme booking -destination id=<udid> -allowProvisioningUpdates build` once. The free profile expires after 7 days, then repeat.
- The phone must be unlocked, trust the developer under Settings, General, VPN & Device Management, and allow local network access.
- "No script URL provided" means Metro is down or the app was opened without its URL: `bookslot://expo-development-client/?url=http%3A%2F%2F<mac ip>%3A8081`.
- After an Xcode update `xcrun` fails with code 69 until the user runs `sudo xcodebuild -license accept && sudo xcodebuild -runFirstLaunch`. A codesign keychain password prompt the user cannot answer means a certificate Xcode did not create: delete it in Keychain Access and let `-allowProvisioningUpdates` create a new one.

`web/`

- `npm run dev` — Vite on :5173. Reads the API from `VITE_API_URL`, default http://localhost:3000.
- `npm run build` — typecheck and production build into `dist/`. The routes are real paths, so whatever serves `dist/` has to rewrite unknown paths to `index.html`. `dev` and `preview` already do, which is why a missing rewrite only shows up once it is deployed.
- `npm run generate` — rewrites the generated theme and icons, see Generated types. Runs by itself before `dev`, `build` and `check`.
- `npm run check`: Prettier, TypeScript and ESLint.

Agents may start, restart and stop the `server/` and `web/` dev servers. One may already be running: check with `lsof -tiTCP:<port> -sTCP:LISTEN` and reuse it. Vite HMR and `tsx watch` pick up changes without a restart.

# Clients

- The server owns the booking rules, all in `server/src/booking/lifecycle.ts` (book, queue, release, an apartment letting everything go), under the apartment's lock. Push to a queue goes out after the response through the notifier `buildApp` is given; tests pass `memoryPush()` from `server/src/test/fixtures.ts` and await `server.notifier.idle()` before looking at what was sent.
- The client renders what it is told. What a time or a queue place offers (label, look, whether it can be pressed, what pressing does) is decided in `core/src/booking/offer.ts`; the clients only map it to their classes.
- An account (`user`) belongs to one organization and is a resident (`memberId`), an admin (`admin`) or both; `getSignedIn` in `server/src/lib/user.ts` answers with both parts. Residents sign in with a code mailed to them (Better Auth's `emailOTP`), admins with a password; `POST /sign-in/method` tells the login screen which. `AccountGate` in `src/auth/account.tsx` picks the app from the account and a mode, held as state in the app and read from the route on web; an account with both switches through `SwitchModeContext`. The admin app mounts no booking screens or push.
- Mail goes through `server/src/lib/mail.ts` (SMTP, Mailpit in dev) the way push goes through `lib/push.ts`; the texts live in `server/src/mail/mail.service.ts`, and tests read what was sent from `memoryMail()` in `server/src/test/fixtures.ts`.
- `web/` is one app. Below 1024px it renders the same screens as `app/`; above it renders the calendar and day view in `src/desktop/`, which loads the whole booking window for every resource in one `/schedule` request.
- `core/` (`@booking/core`) holds what both clients share: the API types and the client's core (`createApi`), error codes, i18n, date helpers, the load state (`load/`), and the actions behind the member and admin screens (`booking/bookingActions.ts`, `admin/actions.ts`), which ask through the `Dialog` port. It is TypeScript read straight by Metro and Vite, with no build step, and runs in plain Node: it never imports `react-native`, `expo-*`, the DOM, `app/` or `web/`. UI, platform calls and the adapters that feed core a platform (`src/api/client.ts`, `src/hooks/useBookingActions.ts`, `src/hooks/useAdminActions.ts`, `src/hooks/useFocusLoad.ts`) stay in the clients, which depend on core and never on each other.
- New date helpers, strings and other shared logic go in `core/`, tested there. What only the desktop calendar needs goes in `web/src/desktop/weeks.ts`.
- Some client files read the same in both but bind platform code, such as `config.tsx` and `src/auth/session.tsx`. `scripts/check-mirrors.mjs` lists them and fails when the copies differ, so change both.
- Every visible string lives in `core/src/i18n/sv.ts` and `core/src/i18n/en.ts`. A new string goes in both, and TypeScript refuses an English catalog that lacks a Swedish key. Components read it with `useMessages()`; helpers outside components take it as a `t: Messages` argument. Never write UI text inline.
- The organization picks its languages (`locales`), and the clients show only those. Its own text (resource and kind names, tags, rules, announcements) is jsonb with a value per language. The server resolves it from `Accept-Language`, so member endpoints return plain strings and admin endpoints the whole object (`server/src/lib/locale.ts`). Untranslated text falls back to a language it is written in.
- The language is per device: the one picked under Lägenhet or Föreningen, else the first device language the organization uses, else English if it uses it. Push tokens carry it, and the server writes push in it.
- `web/` is on Tailwind v4 (CSS-first, tokens in `@theme`); `app/` stays on the v3 LTS that NativeWind needs. Do not copy config between them.
- Match the app's result, not its layout mechanism. Anything sized from the viewport in React Native is wrong on web, where one breakpoint spans phone to laptop.
- Keep the clients symmetric. No hook or helper file in one client unless the other gets the same shape. Short logic stays inline in the component.
- Data loading is hand-rolled, in `core/src/load/`; a screen loads through its client's `useFocusLoad`. Never add TanStack Query, SWR or another server-state library.
- Ask and tell through `useDialog`. In the app `Alert.alert` appears only in `src/components/Dialog.tsx`, so the button conventions live in one place.
- Layout that depends on the mobile viewport (`dvh`/`vh`, fixed bottom bars, safe areas) cannot be verified in desktop Chrome, nor by a script that fakes a width, since the toolbar never collapses there. Prefer designs without viewport units; otherwise report it as unverified and needing a real phone, and do not call it verified.
- If web push shows as Chrome instead of Boka on macOS, that is Chrome's `AppShimNotificationAttribution` feature flag, not our code. Do not touch `push-sw.js` or the manifest for it.

# Rules

- Reuse existing helpers and components. Search before writing a new one.
- In `app/` and `web/`, import with the `@/` alias, never `../`, and core as `@booking/core/<path>`, such as `@booking/core/lib/dates`. `core/` and `server/` have no alias and use relative imports; `@/` in core would point into whichever client imports it.
- drizzle/ is .gitignored as of now during development, no need to bring it up.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project. Do not repeat what the codebase already shows; point to the authoritative file or command instead. Prefer rewriting or pruning existing entries over appending new ones. When updating this file, preserve this bar for all agents and keep entries concise.
