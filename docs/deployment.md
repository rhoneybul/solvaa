# Deploy Solvaa on Vercel and Supabase

Checked September 28, 2026. The repository includes the full web frontend and backend. Production sign-in is mandatory; local development can be previewed without credentials.

## Cheapest setup

Use the existing Vercel project and a Supabase Free project, with AI disabled. No dedicated backend server or image-storage bucket is needed. Vercel serves static assets and a single Express function; Supabase stores accounts, profiles and saved routes. Drafts, activity files and images stay on-device.

Vercel Hobby is $0 for **personal, non-commercial** use within its allowances. Commercial use requires Pro (currently $20/month base) or another suitable host. [Hobby restrictions](https://vercel.com/docs/plans/hobby), [Vercel pricing](https://vercel.com/pricing).

Supabase Free currently includes a 500 MB database and 50,000 monthly active users. Free projects can pause after a week of inactivity; automated backups are not included. [Supabase pricing](https://supabase.com/pricing).

Authentication emails need a configured SMTP service for a public launch. Supabase's built-in sender is restricted to team addresses, currently two emails/hour. Reuse any existing SMTP setup; a provider free allowance may cover early usage, with a sending domain as a separate cost. [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Existing deployment and access

A new [Vercel preview](https://solvaa-git-codex-web-map-planner-rhoneybuls-projects.vercel.app) was deployed from [draft PR #10](https://github.com/rhoneybul/solvaa/pull/10). Vercel reported Ready and GitHub validation passed. The preview retains existing Vercel account protection, so browser/API smoke checks redirect to Vercel sign-in until access is supplied. Production promotion and hosted Supabase verification remain pending.

- Repository: `rhoneybul/solvaa`, main branch.
- Previous public website: https://paddle-kayak.vercel.app (Vercel project appears as `solvaa` in deployment records).
- Old frontend public configuration references Supabase project `kseznjbmxhpdogrhyjfb` and the historical Railway API. The Supabase hostname did not resolve during this work. Inspect the dashboard for a paused/restorable project before creating another.
- Dashboard sign-ins and CLI credentials were unavailable. Remote schema, secrets, auth redirects and SMTP remain unverified; no migration has been applied to the hosted project.

## Configure the existing Supabase project

1. Sign in at https://supabase.com/dashboard and locate the old project. Restore it if available; otherwise create a Free project in a nearby region. Preserve any existing data.
2. Run `server/supabase/migrations/003_web_accounts_and_ai_budget.sql` in its SQL Editor. This adds private `web_workspaces`, private AI usage events and the atomic quota function. It does not modify earlier saved routes. It uses the built-in `auth.users` table and can run independently of the old native-app migrations. Do not rerun migrations 001/002 on an existing project blindly.
3. Enable email/password sign-in and email confirmation. Configure SMTP for external users and retain sensible Auth email rate limits. Do not disable confirmation just to avoid email setup.
4. Set Auth → URL Configuration → Site URL to the eventual production origin, normally `https://paddle-kayak.vercel.app` if retained. Allow the exact production `/#account` redirect and the exact test preview origin plus `/#account`. Do not add a broad all-Vercel wildcard.
5. Retrieve the project URL, public publishable key (or legacy anon key), and server secret key (or legacy service-role key). Put secrets into Vercel settings, never source files or chat.

## Configure Vercel

Use the existing `rhoneybul/solvaa` integration and repository root. The checked-in configuration overrides install/build/output settings:

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Node | 22.x |
| Install | `npm ci --include=dev && npm --prefix server ci --omit=dev` |
| Build | `npm run build` |
| Output | `dist` |
| API | `api/index.js`, Express handler, 30-second maximum |

Set the following in **Production and the intended Preview environment**, then redeploy. Do not print private values in build logs.

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Active project's HTTPS URL |
| `SUPABASE_PUBLISHABLE_KEY` | Public key; `SUPABASE_ANON_KEY` also works |
| `SUPABASE_SECRET_KEY` | Server key; `SUPABASE_SERVICE_ROLE_KEY` also works |
| `AI_ENABLED` | `false` |
| `ALLOWED_ORIGINS` | Production origin; use a separate preview setting if needed |
| `VITE_API_URL` | Omit: website and API share one origin |
| `NOMINATIM_BASE_URL` | Omit initially |

Former `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` settings are fallback aliases for the public connection only. Replace them if they still point to the unresolvable project. No server secret belongs in any public-prefixed variable.

`NODE_ENV=production` or Vercel's built-in `VERCEL=1` enforces authentication across application APIs. `/api/config` and `/health` are public. Missing authentication configuration never falls back to an anonymous production workspace. `/api/config` contains only public keys and capability flags.

The API uses Vercel's edge-controlled client-IP header only when running on Vercel. Other deployments conservatively use the socket/Express address unless an operator explicitly configures proxy trust. [Vercel request headers](https://vercel.com/docs/headers/request-headers).

## Map providers

OpenStreetMap tiles and Overpass provide map/place data. Public Overpass was returning 406/504/timeouts during verification; the UI keeps manual plotting available and labels provider failures. Skye's directory links have no invented coordinates. Set `OVERPASS_URL` to a reliable compatible service if needed, respecting its policy. The in-process and browser caches reduce requests but are not an application-wide serverless rate limiter. For larger usage use a suitable managed service or a durable cached regional extract. [Overpass instances and policies](https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances).

Do not enable the public Nominatim server on this Vercel architecture: its one-request/second application-wide requirement is incompatible with only a per-instance limiter. A self-hosted or managed compatible endpoint can be configured under its own allowance. Home pinning, known region shortcuts and rounded device location need no geocoding provider. [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/).

## Optional AI later

After verifying the migration, set `CLAUDE_API_KEY`, a stable random `AI_IP_HASH_SECRET`, and `AI_ENABLED=true`. Default limits are 3/user/day, 10/user/month, one-minute cooldown, 10/IP/day, 20/site/day and 100/site/month. All paid entry points reserve an atomic PostgreSQL quota before the provider call. Errors count, output is at most 768 tokens, calls time out after 20 seconds and are not retried automatically. Missing quota storage blocks AI. Keep the provider's own spending cap low as a second bound.

## Verify before promoting

- Build and run `npm test`; the suite covers manual GPX separation, import handling, production authentication and AI guard failures.
- Visit `/health` and `/api/config`; confirm `authRequired: true` and the correct active project URL. Unauthenticated `/api/account/workspace` and `/api/explore/points` must return 401.
- Create a test email account, confirm email, sign in, complete onboarding, save a two-day plotted route. Sign out/in and check it returns. Verify password recovery on the final allowed origin.
- Check a second account cannot read the first account's workspace. The backend derives ownership from the verified JWT; private tables have no anon/authenticated direct grants.
- Test a 390px phone viewport and desktop, exact exported point coordinates and separate daily tracks. A GPX file is user-plotted and unvalidated, never advertised as guaranteed safe water navigation.
- Promote the verified preview or merge the deployment branch to the configured production branch. Retire the old Railway/Render service only after the new origin works and data retention has been checked.
