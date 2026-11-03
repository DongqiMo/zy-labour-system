# Free Web System Deployment

The default architecture is static hosting + Supabase Free (PostgreSQL, Auth, and an account-management Edge Function). Paid Render disks are not required. No automatic plan upgrades or billing resources are created. Verify current storage, bandwidth, function, and inactivity limits with each provider. Photo/PDF data URLs consume database space; export regularly and migrate before reaching limits. Unlimited capacity or permanently active free hosting is not guaranteed.

## Create a free Supabase project

1. Create an account and **Free** project at https://supabase.com/dashboard. Store the database password securely; do not send it in chat or commit it.
2. Execute `supabase/migrations/202611030001_zy_shared.sql` in SQL Editor. Business tables use the private `zy_private` schema, RLS, and revoked direct table permissions. Clients call explicitly granted RPCs. Do not expose `zy_private` through PostgREST or grant direct client access.
3. Disable public signups in Authentication. Administrators provision team accounts. Auth users without active team membership cannot access business RPCs.
4. In Authentication → Users, create your own real email account with a password of at least 12 characters. Enter the password only in the private dashboard. Run the following SQL as the project owner, replacing the placeholder with that account's email. Confirm exactly one returned row:

```sql
insert into zy_private.members(id,username,role,active)
select id,email,'admin',true from auth.users where email='YOUR_OWNER_EMAIL'
returning id,username,role;
```

Never automatically grant administrator privileges to the first website visitor. There is no public administrator-bootstrap API.

5. Obtain the HTTPS project URL and **public publishable key (or legacy anon key)** from API settings. They may be stored in GitHub repository variables. Never put service-role keys, `sb_secret`, database passwords, or Auth administrator credentials in frontend files.
6. For in-app account provisioning, deploy `supabase/functions/team-admin/index.ts` as `team-admin`, either through the function dashboard or with `supabase functions deploy team-admin --project-ref YOUR_PROJECT_REF`. `supabase/config.toml` sets `verify_jwt=false` because the function sends the caller's actual Bearer JWT to a PostgreSQL RPC for validation, including newer signing keys. The function still requires an active team administrator; management is not anonymously accessible.
7. Set the Edge Function secret `ZY_ALLOWED_ORIGINS` to the actual website origin(s), comma-separated, for example `https://OWNER.github.io`. Omit repository paths and trailing slashes. Supabase injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`; never copy the service-role key to the website or chat. Unauthorized origins are rejected. Without an allowed origin, account creation is not open.

Account creation first creates an Auth user, then registers membership using the caller's authority. Membership failure triggers an attempt to remove the newly created Auth user. An orphaned Auth user without membership still cannot access business data and can be cleaned up in the dashboard. Disabling membership immediately blocks business RPCs, including calls using an unexpired JWT.

## Static hosting: choose one provider

### GitHub Pages

GitHub Free generally requires a public repository for Pages. A private repository can instead use another static host. Source code may be public; real business records, backups, and passwords must remain private.

1. Review and push the repository code. This project's public repository and Pages deployment are already established.
2. `dist/config.js` contains the configured public project URL and publishable key. To change projects, set both `SUPABASE_URL` and `SUPABASE_ANON_KEY` under Settings → Secrets and variables → Actions → Variables. If variables are absent, the build uses validated committed public configuration.
3. Under Settings → Pages → Build and deployment, select GitHub Actions.
4. Run `Publish free static website` manually for initial deployment; subsequent matching pushes trigger the workflow. It uploads only `dist`, excluding the server, databases, and backups. Configuration generation rejects administrator keys. Confirm successful deployment and use the actual workflow `page_url`.
5. Add the website origin to `ZY_ALLOWED_ORIGINS`. Set Supabase Auth → URL Configuration → Site URL to the full website address. Allow only explicitly approved Redirect URLs. Current password login has no external redirect flow.

Current website: https://dongqimo.github.io/zy-labour-system/

The `team-admin` Edge Function is a separate deployment; successful Pages deployment does not deploy it. If it is unavailable, provision Auth users through the Supabase dashboard and explicitly add the appropriate membership.

### Cloudflare Pages

At https://dash.cloudflare.com, choose free Pages static hosting and connect the GitHub repository. Use build command `python3 scripts/configure_static.py`, output directory `dist`, and the same two **public** environment variables. Paid Workers, a Python backend, a paid database, and a purchased domain are not required. Add the assigned website origin to the function allowlist. Check the provider's current free-plan terms.

## Production acceptance checks

- Unauthenticated visitors and Auth users without team membership cannot read business records.
- Administrator and staff logins in separate browsers share records; a staff-created order appears in the administrator's list after approximately five seconds. Verify salary formatting, source text, and package-price status.
- Polling does not replace active forms; stale concurrent saves are rejected. Staff cannot provision or disable accounts.
- Administrators can export all business records, restore into an empty database, and suspend/resume writes.
- Disabling staff membership blocks existing JWTs from business RPCs. Password changes revoke refresh sessions, but existing Supabase access JWTs may remain valid until expiry. Global logout is not immediate revocation of all access JWTs; live membership checks enforce immediate business-access removal.
- Clearing local login state does not delete team data; another browser can log in and read records.

Local PostgreSQL permission/migration tests do not establish hosted Auth, Edge Function, networking, free-plan capacity, or disaster-recovery behavior. Verify these against the actual project.

## Local and self-hosted fallback

`npm start` uses Python/SQLite without a Supabase account. Create a local administrator with `python3 server/app.py create-admin --username owner`; passwords use a private terminal prompt. The SQLite database resides under Git-ignored `var/`. This is a local/self-hosted fallback rather than a requirement to purchase hosting.

`npm run start:static` serves the static frontend. An unconfigured cloud connection shows a connection warning; saving never silently falls back to browser storage. Configure only public values in `dist/config.js`, or set the environment variables and run `python3 scripts/configure_static.py`.

See the README for local HTTP/production HTTPS and full SQLite backups, and the [database migration guide](database-migration.md) for portable business data.
