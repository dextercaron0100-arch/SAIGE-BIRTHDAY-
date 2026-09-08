# Valyria Saige · Turns One

A personalized first-birthday invitation and private RSVP guest book, built with React, Vite, TypeScript, Supabase, and Vercel Node.js Functions.

**Celebration:** Friday, September 11, 2026 · 6:00 PM–8:00 PM · Jollibee Crossing · Asia/Manila. The RSVP deadline, street address, and map URL remain unconfigured. Valyria’s supplied pink portrait is the featured image, with her family photos presented in an interactive carousel. Every invitation reserves exactly one named seat.

## Start in Visual Studio Code

1. Install Node.js 22.12 or newer (Node.js 24 LTS recommended), Git, and VS Code.
2. Open this folder in VS Code, then open **Terminal → New Terminal**.
3. Run:

   ```sh
   npm ci
   npm run dev
   ```

4. Open **http://127.0.0.1:5173/preview**. No accounts or credentials are needed for this sample. On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.

`npm run dev` starts Vite on port 5173 and the local Node API on port 3001. Vite proxies `/api` to those same handlers used by Vercel. Both ports bind to localhost. Stop both with Ctrl+C. The repository includes `package-lock.json`; use `npm ci` for reproducible installs.

The sample guest is fictional. Sample replies live only in React memory, are never sent to the API, and explicitly say they were not saved. Refreshing resets them. `/` explains how to use a personal link; `/admin` is the organizer login. A real invitation never silently falls back to sample mode.

## Connect Supabase

1. Create a Supabase project.
2. Apply the database migration with the Supabase CLI: `npx supabase login`, `npx supabase link --project-ref YOUR_PROJECT_REF`, then `npx supabase db push --linked`. Alternatively, execute `supabase/schema.sql` once in **SQL Editor**. Both paths create the guests table, constraints, timestamp trigger, restricted RSVP function, and RLS rules. Do not apply both paths to the same project.
3. In **Authentication → Providers**, enable email/password authentication. Disable public user signups for this private organizer application.
4. In **Authentication → Users**, create an organizer with an email/password and confirm the email (or complete the confirmation email flow). Copy the user's UUID. Do not put a password into the source code or environment file.
5. Copy `.env.example` to `.env.local` and replace the placeholders:

   | Variable                    | Where it runs | Value                                 |
   | --------------------------- | ------------- | ------------------------------------- |
   | `VITE_SUPABASE_URL`         | Browser       | Project URL                           |
   | `VITE_SUPABASE_ANON_KEY`    | Browser       | Publishable key or legacy anon key    |
   | `SUPABASE_URL`              | Server        | Same project URL                      |
   | `SUPABASE_SERVICE_ROLE_KEY` | Server only   | Secret key or legacy service-role key |
   | `ORGANIZER_USER_IDS`        | Server only   | Comma-separated authorized user UUIDs |

6. Restart `npm run dev`, open `/admin`, and sign in. An authenticated account without an allowlisted UUID receives a 403 and cannot read or change guests. An empty allowlist grants no organizer access.

Run `npm run verify:supabase` to confirm the remote database is connected and direct anonymous table/RPC access is blocked. The report contains no keys, guest names, email addresses, tokens, or messages.

The browser key is deliberately public. Secret/service-role keys must **never** have a `VITE_` prefix. `.env` and `.env.*` files are ignored except for the placeholder-only `.env.example`. Supabase URL and keys are available in your project’s API settings. All four Supabase values must reference the same project.

## Customize the event

Edit **`shared/event.ts`**, the single source of truth for event details, timezone, theme colors, photos, and deadline. Redeploy after changes; changing only the browser cannot override server deadline enforcement.

- `startsAt` and `endsAt` contain the confirmed party range with explicit `+08:00` offsets. Setting `startsAt` to `null` shows “To be announced” and hides the countdown.
- `venue` and `address` are optional text. `mapUrl` must be an HTTPS URL. Directions appear only when both the venue and map URL are present.
- `rsvpDeadline: null` keeps RSVPs open. To close at a particular instant, configure an explicit-offset timestamp, for example `2026-09-09T23:59:00+08:00`. At that instant and afterward, updates are rejected by the server and database. Saved responses remain readable.
- Timestamps require seconds and a numeric offset, such as `+08:00`; offset-free timestamps and `Z` shorthand are rejected to keep configuration explicit. Displayed times use `Asia/Manila`.
- Put actual family-supplied photos in `public/photos/` and add entries to `photos`, e.g. `{ src: '/photos/valyria.jpg', alt: 'Valyria smiling in the garden' }`. Use descriptive alt text and compressed images. Empty photos hide the gallery. No baby photos are fabricated.
- Edit `colors` to change the shared pink palette. Welcome and family messages are in `src/Invitation.tsx`.
- Fonts are self-hosted through npm packages with local serif/sans-serif fallbacks. There is no music, analytics, or third-party map embed. Motion respects reduced-motion preferences.
- The formal invitation cover uses the optimized generated assets in `public/assets/`: a transparent satin bow and a blush satin backdrop. They contain no names, event text, baby photos, logos, or watermarks; all meaningful invitation text remains accessible HTML.

## Create and manage real invitations

1. Sign in at `/admin` on the deployed site.
2. Enter **one guest’s name** and select **Create invitation**. Names need not be unique, so take care not to create the same person twice.
3. Use **Copy link** beside that guest and privately share it. Links use the current site origin, e.g. `https://your-project.vercel.app/#invite=TOKEN`. Create/copy production links on the production site, not on localhost or a Vercel preview deployment.
4. Guests open their cover, select “Joyfully attending” or “Unable to attend,” optionally enter up to 500 characters, and submit. Their assigned name is read-only; there is no companion count or guest-list access.
5. Reopening the original link retrieves the saved response and allows updates until the deadline. A successful write updates the same row; it never creates a second RSVP.
6. Use search and response filters, refresh for fresh responses, and read totals. One attending guest equals one attending seat. CSV exports include **all guests**, regardless of active filters, and exclude tokens.
7. To invalidate a shared link, select **Replace link** and confirm. Existing attendance/message data stays intact; the old link cannot read or write that invitation. Copy and privately share the replacement. If a write completed before replacement, its response is retained.

**Invitation links are bearer credentials. Anyone holding a link can read and update that guest’s RSVP.** The browser captures its token into memory and removes the URL fragment. Refreshing the cleaned URL requires reopening the original personal link. Tokens are not persisted in local/session storage. The admin session is managed by Supabase Auth, separately from invitation tokens.

## Security and API behavior

| Route               | Methods   | Authorization                              |
| ------------------- | --------- | ------------------------------------------ |
| `/api/invitation`   | POST      | `{ token }` in JSON body                   |
| `/api/rsvp`         | POST      | `{ token, status, message? }` in JSON body |
| `/api/admin/guests` | GET, POST | Supabase Bearer JWT; POST body `{ name }`  |
| `/api/admin/rotate` | POST      | Supabase Bearer JWT; body `{ id }`         |
| `/api/admin/export` | GET       | Supabase Bearer JWT                        |

- Every admin request calls Supabase `auth.getUser(jwt)` and checks the returned UUID against the server allowlist. Never rely on browser session claims for server authorization.
- Each invitation uses 32 cryptographically random bytes encoded as 64 hexadecimal characters. Tokens are unique, stored only in the protected guests table, and returned only to authorized organizers. They appear in POST bodies, not API query strings.
- RLS is enabled with no anonymous/authenticated policies, and table/function privileges are revoked for those roles. The server uses the privileged service role. The RSVP function is security-invoker and executable only by that role.
- The SQL function locks the token-matched row, checks database time after obtaining the lock, then writes the response. API deadline checks supply immediate feedback; the database check also covers writes delayed by locks. The deadline is supplied solely by trusted server configuration, never accepted from the guest.
- Methods, JSON shapes, names, tokens, status, IDs, and messages are validated. POST bodies are limited to 8 KiB, including streamed bodies; malformed JSON, compression, and unsupported content types are rejected. APIs return `no-store` headers and generic storage errors.
- There is no application request-body logging. Do not enable request-body tracing in hosting/database monitoring: Supabase infrastructure may process token filters and RPC bodies. Keep access to that infrastructure private. Avoid sharing logs, guest exports, or screenshots containing personal details.
- CSV values are quoted, embedded quotes are escaped, and dangerous formula/control prefixes are neutralized with an apostrophe. Invitation tokens and guest IDs are excluded.
- Guest lists are paginated internally to avoid Supabase’s default per-response row cap. The dashboard loads the full list and does not poll automatically; select Refresh as needed.

## Checks

```sh
npm test
npm run typecheck
npm run format:check
npm run build
```

`npm run format` applies Prettier formatting. `npm run test:watch` watches unit/integration tests. `npm run preview` serves the production frontend only; use `npm run dev` for local full-stack functionality.

Tests cover API token isolation, validation, updates, deadline boundaries, per-route organizer authorization, token replacement, CSV safety, HTTP errors/body limits, failed frontend submissions, saved response restoration, preview isolation, and conditional event sections. Database tests execute the actual SQL in embedded PostgreSQL (PGlite), including service-role access, forbidden roles, constraints, deadlines, and replacement behavior. They require no Supabase credentials and do not mutate a remote database.

For desktop and mobile browser checks, run `npx playwright install chromium` once, then `npm run test:browser`. The browser suite starts the development server if necessary and saves full-page screenshots in ignored `artifacts/`. To use an installed Chrome instead, set `PLAYWRIGHT_CHANNEL=chrome` (PowerShell: `$env:PLAYWRIGHT_CHANNEL='chrome'`) before running the suite. The preview checks use no API; real-response checks use explicitly mocked APIs. No live guest data is created.

A live Supabase/Vercel smoke test remains necessary after connecting accounts: create two guests, confirm isolation, update a reply, rotate a link, verify both login authorization cases, and verify deadline enforcement with a temporarily configured deadline. Restore the intended configuration afterward.

## Push to GitHub and deploy to Vercel

1. Check that no real keys or guest data are staged. Create an empty GitHub repository, then run:

   ```sh
   git init
   git add .
   git commit -m "Build Valyria birthday invitation and RSVP"
   git branch -M main
   git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
   git push -u origin main
   ```

2. In Vercel, import the repository and use the **Vite** framework preset. Use Node.js 24, build command `npm run build`, and output directory `dist`. Root-level `api/` files deploy as Node.js Functions; no separate API service is needed.
3. Add all five environment variables above to the appropriate Vercel environments. Prefer a separate Supabase project for staging if preview deployments need real data. Never use untrusted preview code with production service-role credentials.
4. Deploy. `vercel.json` routes `/admin` and `/preview` to the SPA while preserving `/api/*` functions. Public browser variables are build-time values, so redeploy after changing them.
5. Set the Supabase Auth Site URL to your production HTTPS origin. This application uses password login; any future email reset/confirmation flows also need appropriate redirect URL settings.
6. Complete the live checks above and create/copy real links from the final production domain.

Account creation, project credentials, organizer allowlisting, GitHub push, and Vercel deployment must be completed using your accounts. Until configured, real invitations and organizer login clearly show a connection/configuration state, while `/preview` remains available.

## Architecture and references

`src/` contains the invitation and admin UI. `shared/` holds event configuration and types. `server/` contains validation, authorization, CSV handling, database access, and the local API adapter. `api/` exports thin Vercel adapters using the same implementation. `supabase/schema.sql` defines the protected storage layer. `tests/` covers service, HTTP, SQL, and React behavior.

Official references: [Supabase user verification](https://supabase.com/docs/reference/javascript/auth-getuser), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), and [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json).
