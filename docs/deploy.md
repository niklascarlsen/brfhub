# Deploy

`deploy/` runs the whole thing on one host with Docker Compose: Postgres, the API, and Caddy, which serves the web client, puts the API under `/api` on the same host and gets the TLS certificate. The page and the API share one origin, as the session cookie (SameSite) needs.

```
browser / app ──https──> Caddy ──/api/*──> server :3000 ──> Postgres
                           └── /* ── web/dist (static, falls back to index.html)
```

## How the parts go live

GitHub and CI only check the code. Going live is done here, and the three parts go live in two ways:

- **The server and the web client** run from the same commit on the host, so updating them is one step and they never disagree. A page already open keeps its code until it is loaded again, and then the new version takes over.
- **The apps** are built with EAS and released through the App Store and Google Play whenever you choose. Phones update in their own time, so older apps keep talking to the new server for weeks.

So the server's API has to keep working for apps already released: adding fields, routes or optional parameters is safe; changing or removing what an app uses breaks it until its users update, so keep the old way alongside the new for a while.

Each client needs only the server. Run just the web client and never build the apps, or the apps alone and leave the web container unused; with both, the server tells their push tokens apart.

## You need

- A host with Docker and ports 80 and 443 open.
- A domain whose DNS points at the host.
- An SMTP service (Resend, Brevo, SES or similar) sending from a domain with SPF and DKIM. Residents sign in with mailed codes, so mail is not optional.
- A VAPID key pair for web push: `npx web-push generate-vapid-keys`.

## First start

```sh
cd deploy
cp .env.example .env        # fill in every value
docker compose up -d postgres
docker compose run --rm server node_modules/.bin/drizzle-kit push
docker compose run --rm server npm run org:create -- \
  --id brf-example --name "Brf Example" --time-zone Europe/Stockholm \
  --admin-email you@example.se
docker compose up -d --build
```

`org:create` prints the first admin's password once. Open `https://<DOMAIN>`, sign in with it, and set up the authenticator. From there everything is done in the admin pages.

## Updating

```sh
git pull
docker compose build
docker compose run --rm server node_modules/.bin/drizzle-kit push   # when the schema changed
docker compose up -d
```

Build first: `docker compose run` uses the image it already has, so a push before the build would apply the previous version's schema.

The server finishes push already on its way before it stops (`stop_grace_period`).

`drizzle-kit push` drops and adds the composite foreign keys on every run, since it reads their columns back in table order. It touches no data.

## Operating

| Task                                                    | Command, from `deploy/`                                                                        |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Logs                                                    | `docker compose logs -f server`                                                                |
| Another organization                                    | `docker compose run --rm server npm run org:create -- ...`                                     |
| Reset the authenticator of an organization's last admin | `docker compose run --rm server npm run admin:reset-2fa -- <email>`                            |
| Backup                                                  | `docker compose exec -T postgres pg_dump -U brfhub brfhub \| gzip > brfhub-$(date +%F).sql.gz` |

Back up `deploy/.env` together with the database. `BETTER_AUTH_SECRET` encrypts the admins' authenticator secrets: a restored database without it forces every admin's two-step to be reset. Schedule the backup daily, keep copies off the host, and restore one once to know it works. It is the only undo for an admin who deletes the wrong thing.

## The native apps

The apps talk to the same API and are built with EAS. Each build profile in [`app/eas.json`](../app/eas.json) reads the EAS environment of the same name (`development`, `preview`, `production`), which holds what the build needs and the repository does not: the public address of the API, and Firebase's file for Android push. A variable set in your own shell does not reach EAS's build servers.

```sh
cd app
npx eas-cli env:set --environment production --name EXPO_PUBLIC_API_URL \
  --value https://<DOMAIN>/api --visibility plaintext
npx eas-cli env:set --environment production --name GOOGLE_SERVICES_JSON \
  --type file --value ./google-services.json --visibility secret
npx eas-cli build --profile production --platform all
```

[`app/app.config.ts`](../app/app.config.ts) takes `GOOGLE_SERVICES_JSON` on EAS and `app/google-services.json` in a local build, and builds Android without push when there is neither.

Push to the apps goes through Expo's push service, which needs the platforms' credentials in your Expo project:

- **iOS**: an Apple Developer Program membership. `npx eas-cli credentials` creates and uploads the APNs key.
- **Android**: a Firebase project with an Android app for the package in `app/app.json`. Its `google-services.json` goes up as `GOOGLE_SERVICES_JSON` above, and an FCM V1 service account key with `npx eas-cli credentials`.

### Your own app

[`app/app.json`](../app/app.json) is set up for its author's Expo project. To publish the apps under your own:

- Remove `owner` and `extra.eas.projectId` from `app/app.json` and run `npx eas-cli init` in `app/`, which creates the project under your account and writes them back. The push credentials above belong in that project, since push tokens are issued for it.
- Pick your own `ios.bundleIdentifier` and `android.package`, now `com.bookslot.app`. The Firebase Android app must use the same package.
- If you rename the URL scheme `bookslot`, rename it in `trustedOrigins` in [`server/src/auth/auth.ts`](../server/src/auth/auth.ts) too, which lets the app sign in.

The web client and the apps can be used together or alone: the server tells the token kinds apart and sends each its own way.

## Limits of this setup

- **One server instance.** Better Auth's sign-in limits and the API's own rate limits count in memory, and the push receipts are checked from memory. More than one instance needs `rateLimit.storage: 'database'` in `server/src/auth/auth.ts` and a shared store for `@fastify/rate-limit` in `server/src/app.ts`. The wait between mailed codes is kept in the database already.
- **One host.** Postgres runs in a container with a local volume. For more safety, point `DATABASE_URL` at a managed Postgres with point-in-time recovery and drop the `postgres` service.
- **A different reverse proxy.** If something else than the bundled Caddy is in front, set `TRUSTED_PROXIES` to its addresses, and serve `web/dist` with a rewrite of unknown paths to `index.html`. The headers in [`deploy/Caddyfile`](../deploy/Caddyfile) show what the page needs.
