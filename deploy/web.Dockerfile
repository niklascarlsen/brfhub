# The web client, built from the repository root since it reads core and
# the theme in app/, and served by Caddy together with the API behind it.
FROM node:24-alpine AS build

WORKDIR /repo

COPY package.json package-lock.json ./
COPY core/package.json core/
COPY web/package.json web/
# npm checks every workspace against the lockfile, but only web's
# dependencies are installed.
COPY app/package.json app/
RUN npm ci --workspace web

COPY core core
COPY web web
# npm run generate reads the colours from here.
COPY app/src/theme.ts app/src/theme.ts

# The API is reached on the same host, so the session cookie is sent.
ENV VITE_API_URL=/api
ARG VITE_VAPID_PUBLIC_KEY
ENV VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY
RUN test -n "$VITE_VAPID_PUBLIC_KEY" && npm run build --workspace web

FROM caddy:2-alpine

COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/web/dist /srv
