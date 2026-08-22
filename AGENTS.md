# Expo

When working in `app/`, read https://docs.expo.dev/versions/v57.0.0/ before
writing code. The API has changed, do not rely on what you remember.

# Generated types

`server/openapi.json` and `app/src/generated/api.d.ts` are generated. Never
edit them by hand. Change the Zod schemas in `server/src/schemas/`, then from
`server/` run `npm run types:gen`, and `npm run types:check` to verify sync.

# Rules

- The server owns the booking rules. The client renders what it is told.
- Make the smallest change that solves the stated problem. Do not restructure
  working code unless that is the task.
- Fix the cause, not the symptom. Investigate before patching.
- Verify before claiming, read the file or run the command.
- Reuse existing helpers and components. Search before writing a new one.
- Names and structure carry the meaning, not comments.
- Swedish in the UI, English in code and commits.
- drizzle/ is .gitignored as of now during development, no need to bring it up.
