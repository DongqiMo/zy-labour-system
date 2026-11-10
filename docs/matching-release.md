# Matching implementation and release report

## Scope

Implemented the replacement task's independent matching page, eligibility gates, experience-first scoring, linked worker profile, privacy controls, translated evidence, in-memory caching, sync preservation and registration navigation protection. The intermediate R/F/critical-language proposal is superseded; language never caps grades.

Implemented current-only AI matchProfile metadata, literal evidence/type/category validation, stale-hash fallback, save-time classification and manual reanalysis. Order classification shares the existing recognition request; worker classification is one request for changed relevant input. Existing quotas/authentication are reused; failures never prevent worker save. Frontend checks the hosted classification capability and otherwise continues with rules.

## Files

Frontend/runtime:
- dist/job-categories.js
- dist/matching.js
- dist/match-view.js
- dist/index.html
- dist/order-list.js
- dist/order-recognition.js
- dist/ai-recognition.js
- dist/supabase-adapter.js
- dist/shared.js
- dist/workflow-guards.js
- dist/workspace-theme.css
- dist/i18n.js
- server/app.py (local test/development runtime: static routes and bounded matchProfile validation)

Supabase:
- supabase/functions/recognize-order/index.ts
- supabase/functions/recognize-order/match-profile.ts
- supabase/migrations/202611100001_match_profile.sql

Verification/documentation:
- tests/matching.mjs
- tests/matching-ai.mjs
- tests/matching-edge.ts
- tests/postgres.mjs
- scripts/matching_smoke.py
- scripts/order_list_smoke.py (asserts three visible mobile entries; matching is available through Registered Workers)
- package.json
- docs/matching-rules.md
- docs/matching-release.md
- docs/update-log.md

## Validation

Passed locally with disposable/synthetic data:
- npm run check
- npm run test:parser
- npm run test:transport
- npm run test:postgres
- npm test (10 backend tests)
- python3 scripts/smoke.py
- python3 scripts/workflow_smoke.py
- python3 scripts/order_list_smoke.py
- python3 scripts/matching_smoke.py (America/Toronto and Asia/Shanghai)

Matching regressions cover hard constraints including exact age boundaries and related-history absence, periods/current-month/business-day boundaries, linear duration factors, recency, best/second history, Hong Kong bonuses, equal known-condition averages, currency mismatch, certificates, language OR/AND and no caps, intent-only exclusions, grade thresholds, source immutability and no private-field scoring.

Mocked AI checks cover allowlisted transport, valid metadata, unknown categories, nonliteral evidence, stale hash, quota denial, timeout/failure fallback, server-only credentials and single quota reservation. Browser checks include AI labels/stale metadata, worker save without AI, entries/search/counts, one expanded row, profile highlights, company-only copy, privacy/masking/preview, filter/cache/sync, missing-history/empty/excluded states, read-only UI, dirty registration guards, 375/390px layout and translated UI with protected business values.

Actual synthetic November 9 outcomes:

| Job | Score | Grade |
| --- | ---: | --- |
| Hotel room attendant, Cantonese | 100 | High |
| Cleaner, fluent Cantonese + simple English | 100 | High |
| Kitchen helper, Cantonese | 84 | High |
| Kitchen helper, fluent Mandarin | 78 | High |
| Warehouse, MOP salary versus HKD expectation | 20 | Low |
| Care worker | — | Excluded: no related history |
| Male dim-sum cook | — | Excluded: gender |
| Office operator, age <=35 | — | Excluded: age/history |

## Hosted deployment

Code is ready for the repository/Pages release. GitHub Pages does not deploy Supabase code or SQL. The managed environment has no configured Supabase deployment identity or CLI, so the hosted migration and Edge Function have **not** been deployed or exercised against real quota counters. No production business data or real DeepSeek call was used.

Owner deployment sequence:
1. Execute supabase/migrations/202611100001_match_profile.sql in the project's SQL Editor. It updates validators only, preserving the existing snapshot-strip trigger and all authorization/revision checks.
2. Deploy the updated recognize-order function and its match-profile.ts dependency through the authorized Supabase CLI/deployment pipeline.
3. With synthetic data only, verify classification status, metadata roundtrip, failed/limited AI worker save and actual quota increments. Until then, the previously deployed function continues rule-only matching through capability fallback.

## Differences and limits

- Unknown stated worker conditions are omitted from F's mean; if all stated conditions are unknown, F is displayed pending and contributes zero. A pure currency mismatch does not activate F. This makes the otherwise unspecified all-unknown case conservative.
- Medium headings say 50+ because related-only histories can score above 75 while remaining medium; a 50–74 heading would be misleading.
- Narrow desktop layouts scroll only the fixed-width result columns inside their panel; mobile pages do not overflow.
- Periods use elapsed calendar months (March 2019–August 2023 = 4 years 5 months). Unknown periods use the specified one-year/0.7 assumption and visibly show uncertainty.
- Classification vocabulary is finite; unfamiliar roles and arbitrary period text can require editing/reanalysis. Old orders use rules until explicitly reanalysed. AI interpretation itself remains advisory despite literal evidence checks.
- No live authenticated site walkthrough or production AI/quota validation is claimed.
