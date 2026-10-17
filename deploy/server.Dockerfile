# The API. Built from server/, which has its own lockfile.
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
# tsx runs the server and its scripts, drizzle-kit pushes the schema, so
# the dev dependencies come along.
RUN npm ci --include=dev && npm cache clean --force

COPY . .

USER node
EXPOSE 3000
# One process, so the stop signal reaches the server and it can let the
# push still on its way finish.
CMD ["node", "--import", "tsx", "src/index.ts"]
