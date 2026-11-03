# Portable Business Data

## Provider independence

The business UI calls a stable application API. `dist/supabase-adapter.js` connects it to Supabase; Python/SQLite is the second implemented adapter. Changing databases requires adapting the transport/backend rather than rewriting order and worker forms.

The portable format is UTF-8 JSON with `format: "zy-labour-portable"`, `version: 1`, `exportedAt`, `orders[]`, and `workers[]`. It retains IDs, company codes, source text, exact salary formatting, price status, business fields, timestamps, education/employment histories, photos, and existing source-PDF data URLs. Migration is not an opportunity to normalize old statuses or convert character sets: values are preserved.

Accounts, password hashes, provider JWTs, sessions, membership roles, and maintenance settings are **excluded**. Re-provision accounts or perform a separately controlled identity migration; business JSON cannot restore passwords. Record versions restart at 1 in the target.

Backups contain personal information, including identity numbers, phone numbers, and photos. Keep them private and outside GitHub and `dist`. `.gitignore` excludes `backups/`, `exports/`, and SQLite files. Export tools reject public output directories; still inspect staged files before committing.

## Migration procedure

1. Create the target schema and administrator, leaving business tables empty. Rehearse the migration and keep the old deployment recoverable.
2. In the source administrator's Account settings, suspend business writes. The database waits for in-flight writes before entering read-only mode. Order, worker, and import writes are blocked; reads and exports remain available.
3. Export all business records as the final JSON backup. Also retain a native database backup: controlled `pg_dump` for PostgreSQL or the SQLite online backup API. Do not assume unconfigured Supabase automatic backups or PITR are available on the free plan.
4. Run `python3 scripts/portable.py inspect --input /private/backup.json`. Record order/worker counts and SHA-256. The command does not print personal record contents.
5. Restore the JSON through the target administrator's Restore to empty database action. The server validates the whole file, duplicate IDs/codes, and target state, then restores in one transaction. Invalid files, nonempty targets, or concurrent changes are rejected without partial overwrite. Browser imports over 32 MB require a controlled migration tool or a future streaming implementation.
6. Export from the target and compare actual `orders`/`workers` values. Different `exportedAt` values and object-key order are expected. Verify photos, attachments, source text, salaries, dates, counts, permissions, and sharing between independent browsers.
7. Switch the public URL/configuration to the target. Keep the source read-only and retire its write entry point to prevent divergent datasets.
8. After stabilization, retain or retire old databases/backups according to business requirements. For rollback, first suspend the new database, export new writes, and plan their merge. Do not resume the old database while silently losing newer records.

## SQLite and PostgreSQL transfers

Supabase portable JSON can be restored into SQLite:

```sh
python3 scripts/portable.py inspect --input /private/backup.json
python3 scripts/portable.py import-sqlite --db /private/new.sqlite3 --input /private/backup.json
python3 scripts/portable.py export-sqlite --db /private/new.sqlite3 --output /private/roundtrip.json
```

Import requires empty business tables; pre-created local accounts may remain. A new database path can create a database but not an administrator. Use `python3 server/app.py create-admin --db /private/new.sqlite3 --username owner` and the private password prompt. Export paths must not already exist; old backups are not overwritten.

SQLite exports can also be restored through `zy_import` into an empty Supabase business database. PostgreSQL → SQLite → PostgreSQL has been tested using an embedded real PostgreSQL engine, with value-by-value checks for orders, photos, source PDFs, and histories. Hosted Supabase networking and large production datasets still require separate verification.

Other PostgreSQL/MySQL providers can implement importers for the same JSON fields. This repository does not implement every database driver or promise one-click migration to every service.
