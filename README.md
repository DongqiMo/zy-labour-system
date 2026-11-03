# ZY Labour System

A labour-order and worker management system rebuilt from the [original migration specification](docs/migration-spec.md). The current application supports account login, shared team records, a free Supabase cloud adapter, a Python/SQLite self-hosting fallback, and editing conflict detection. Business records are stored in the shared database; the interface uses a white background.

Website: https://dongqimo.github.io/zy-labour-system/

## Local development

Requires Python 3.12+ and Node.js for checks. The Python service uses the standard library only.

```sh
python3 server/app.py create-admin --username owner
npm start
```

The first command creates an administrator through a private password prompt (minimum 12 characters; no default password). The development HTTP service listens on loopback port 8080. Production requires HTTPS and Secure cookies. The default database, `var/zy.sqlite3`, is ignored by Git. Never commit databases or real business records.

Administrators manage staff through Account settings. Both roles share and edit business records; only administrators manage accounts. Lists poll every five seconds without replacing active forms. Stale writes are rejected while preserving user input. Local sessions use HttpOnly cookies. Editing a company order does not change its source text.

## Validation

```sh
npm run check
npm test
npm run test:parser
python3 scripts/smoke.py
python3 scripts/worker_smoke.py
npm ci --ignore-scripts
npm run test:postgres
npm run test:transport
```

API tests use temporary standard-library servers and databases. Browser tests require Python Playwright and `/usr/bin/chromium`; they start a temporary service and check independent accounts, shared records, reload persistence, conflicts, permissions, logout, responsive layouts, recognition, batch forms, and interface translation. They create no production accounts or screenshots.

The pinned PGlite dependency is for development tests only. PostgreSQL tests cover permissions, transactional restores, write suspension, and PostgreSQL → SQLite → PostgreSQL transfers. Transport and Edge Function tests use mock HTTP and do not establish hosted Supabase availability. Edge TypeScript tests require Node.js 24. Python/SQLite fallback tests remain supported.

## Free website deployment

The default architecture is **static hosting (GitHub Pages or Cloudflare Pages) + Supabase Free**. See the [deployment guide](docs/deployment.md). There is no requirement for paid Render hosting. Free services have storage, traffic, invocation, and inactivity limits; unlimited or permanently free operation is not guaranteed.

Frontend configuration contains only the public project URL and publishable/anon key. Never expose service-role keys, `sb_secret` keys, database passwords, or administrator credentials. Cloud authentication uses Supabase email/password login. Account provisioning requires the restricted `team-admin` Edge Function; business RPCs check current team membership. Cloud sessions use tab-scoped sessionStorage with refresh; SQLite sessions use HttpOnly cookies. These providers have separate accounts.

## Portable business data

Administrators can suspend writes, export all business records, and restore into an empty database through Account settings. The portable JSON includes orders, workers, photos, attachments, and existing business fields, but excludes account passwords and sessions. Write suspension is enforced in the database; restore validates and commits transactionally. Browser imports are limited to 32 MB.

See [database migration and rollback](docs/database-migration.md). `scripts/portable.py` provides validation, hashes, SQLite export, and empty-database restore. Cross-provider business-data round trips are tested. Accounts must be provisioned again or migrated separately; hosted services and large datasets require deployment-specific acceptance checks.

## Features and boundaries

Features include today's statistics, date-grouped order lists, a monthly entry-date calendar with daily counts, position/company-code search, status filters, single/batch recognition, company order numbers, package-price suggestions, company order editing/copying/deletion, worker registration, compressed photos, education/employment histories, registration preview, browser printing, and worker JSON backup. Traditional-to-simplified conversion lazily loads OpenCC from a CDN; failure is reported and the original text is retained for review.

A new shared database starts empty. It does not create demo records or automatically upload legacy browser data. Existing localStorage/IndexedDB data remains untouched. Administrators can explicitly import legacy data from the same browser origin; duplicate IDs/codes are skipped. A new domain cannot access another origin's browser storage. Full SQLite backups use `python3 server/app.py backup --output /private/new-backup.sqlite3`; worker JSON export is not a full service backup.

The supplied legacy worker export now provides the original registration background, coordinates, and PDF helpers. Worker preview/printing uses that original A4 template, with long-text appendices and an adapted PDF text/OCR import flow. See the [worker registration guide](docs/worker-registration.md) for compatibility, limits, and testing boundaries. Legacy offline caches are disabled to avoid false save confirmations. Offline business operations are unsupported.

## Recognition rules and error memory

Read the [recognition contract](docs/recognition-rules.md) before changing extraction behavior. The [synthetic error catalog](tests/fixtures/recognition-errors.json) records historical causes and expected behavior; `tests/recognition-mechanism.mjs` executes it together with nearby counterexamples, role/currency variants, and source-span coverage checks. [Repository instructions](AGENTS.md) require future fixes to extend this corpus rather than accumulating per-order exceptions. Relevant pushes/PRs run the checks, and Pages publication runs the complete parser gate before deployment. This is durable rule/test maintenance, not autonomous model training.

## Whole-document recognition and publication checks

`dist/order-parser.js` scans the entire source document, determines order and paragraph boundaries, and then classifies positions, employers, salary, gender, age, language, duties, requirements, working hours, rest arrangements, and interviews. It does not rely on fixed line numbers. It supports simplified/traditional labels, adjacent source IDs and job titles, numbered/bulleted paragraphs, decorative prefixes, inline or wrapped headings, and unlabelled role summaries. Approval titles and interview-video instructions are separated from actual positions.

Single-entry mode blocks mixed orders and offers transfer to batch mode. Batch mode uses the same segmentation rules. Uncertain positions, gender, salary, or conflicts require review rather than guessed defaults. Order gender is restricted to the three Chinese business values meaning male, female, and unrestricted; worker registration fields are unaffected.

All leading supplier letters are extracted before source-ID removal. For example, synthetic ID `ABC-20991234` produces `ZY-26-1103-13 ABC`; the prefix is not truncated. Sequence numbers use the base ZY code regardless of supplier suffix. Currency and common standard identifiers are excluded. Source label brackets are removed from company fields.

Source salary text is preserved internally. Company monthly salary is formatted as `HKD15920` or `HKD15920+`, normalizing Hong Kong currency aliases, spaces, thousands separators, and monthly suffixes while retaining a source trailing plus. Explicit foreign currencies and hourly/daily units are preserved; formatting performs no exchange-rate or pay-period conversion. Base-pay breakdowns, allowances, bonuses, and commissions remain in the salary field with their amounts and eligibility conditions. Explicit employee deductions (such as accommodation or meal deductions) go into notes with their amounts or percentages. Upstream package prices, monetary footers/expressions, agency fees, permit fees, and insurance quotations remain excluded. ZY's package price remains a separate input/suggestion. Internal source text retains original amounts for review. Rest cycles are preserved without inventing monthly totals.

Save and publication share checks for mixed orders, uncertain positions/gender, missing publication salary, invalid or duplicate base codes, bracket remnants, full supplier IDs, and upstream quotation remnants. Copied company text keeps its business language regardless of the interface language.

Existing records are not automatically reparsed or overwritten. The editor's Re-recognize source (preview) action proposes fields while preserving the current ZY package price. Only confirmation and save writes changes; source text remains unchanged. Narrow legacy code/label repairs remain separate. Recognition metadata (`parserVersion`, `parsedSnapshot`, `manualFields`, `recognitionAudit`, `reviewConfirmation`, `sourcePrefix`) uses string fields compatible with existing JSON storage.

Single and batch entry share a span-based ledger with classified, excluded, review, and conflict dispositions. The expandable Field Sources and Review Checklist shows source excerpts, exclusion reasons, unclassified/conflicting text, and missing/ambiguous information. New-engine records with unresolved fragments may be saved, but publication requires staff acknowledgement after correction; source changes invalidate acknowledgement, and mandatory fields/fee checks still apply. This internal review content is excluded from company publication text. Navigation uses two non-collapsible groups: Labour Orders and Worker Information. The order database calendar filters by local entry date; date, job/code search, and status filters compose. Recognition remains heuristic and requires staff review. Parser tests include reordered documents, compound IDs, paragraph gender, salary components, mixed-order safeguards, decorative prefixes, HK-dollar formats, and fee confidentiality. Changes to `dist` pushed to `main` trigger website deployment.

## Interface language and complete batch workspace

The English/Chinese button beside the date changes the interface, including login and dialogs. The preference is stored in the current browser. Text updates in place, preserving unsaved fields, passwords, source text, gender selections, and batch edits. Business records, publication text, names, salaries, and stored gender values are not translated.

Batch and single entry share the same two-column workspace: source review on the left, the complete `orderFields` form on the right. Each item exposes code, position, employer, salary, gender, age, language, hours (including shift descriptions), interview, rest, duties, requirements, notes, and ZY package price. Item switching preserves edits; salary edits do not overwrite manually entered prices. Save validates required fields and unique codes, determines each item's `draft`/`ready` status from its price, and submits the batch once. Narrow screens use one column.

See the [update log](docs/update-log.md) for recent changes. The migration specification describes the historical source application; this README describes the rebuilt shared system. Automated local tests do not substitute for verifying production HTTPS, hosted Auth/Edge Functions, remote persistence, or provider recovery.

## Authenticated order self-audit

After login, the browser performs a read-only audit of loaded shared orders. The Source Recognition Audit button refreshes the current list and compares seven required fields with source-derived proposals and their provenance. It highlights missing/uncertain facts instead of inventing them, retains manual company values until explicit review/save, and can download a private report containing original orders. The report can be supplied for manual review; the assistant has not independently accessed the live authenticated dataset.
