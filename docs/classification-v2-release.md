# Occupation classification v2: delivery report

## Implementation

**Frontend:** eighteen fixed broad majors replace the closed eleven-code dictionary. A shared subcategory dictionary supports aliases, immediate AI proposals, ID/merge-chain resolution and administrator override precedence. Rules are the fallback; employer industry is a permitted history clue. Old v1 profiles expire. Matching adds certificate-backed experience, same-major 0.6 relatedness with a medium ceiling, and a separate no-score Manual Judgment group for unknowns. Gender/age gates, 70/30 condition weighting and intent bonuses remain. Real same-major history is never rejected simply because it is short/old. Company/worker fields are not rewritten.

Matching displays major/subcategory evidence, AI provenance, certificate support and missing-duty hints. The admin management dialog provides separate classified/other/unclassified coverage counts, grouped classification data, title-only inventory export, editable names/aliases/majors, confirmation, merges, manual cache assignment, quota and resumable backfill. Business subcategory names remain untranslated; interface/major names support Chinese/English.

**Edge Function:** v2 allowlisted classification accepts worker history employer names, but no worker names, telephone, identity, addresses or photos. DeepSeek and Gemini return classification only. Existing IDs are preferred; new names require valid major/literal evidence. Recognition can include classification in its existing model request; classification failure does not invalidate recognition facts. Standalone requests use an independent team quota and shared cache. Ninety-second per-hash leases prevent duplicate in-flight requests, in addition to sequential cache reuse. Empty position/duties skip the model. Bad/limited/failed/timed-out classifications fall back to rules/manual judgment.

**Migration:** adds public zy_job_subcategories and zy_job_classification_cache, plus private classification usage/settings/lease state. The default is fifty classification reservations per team per China day, separate from recognition's existing team/member limits. Active members can read classifications; direct client table writes are revoked. Service-only RPCs create AI categories/cache and reserve claims/quota. Admin-only RPCs manage dictionary/manual assignments and apply revision-safe metadata patches. The existing firstRecognition trigger is retained.

## Files

Frontend/runtime:
- dist/job-categories.js
- dist/job-classification.js (new)
- dist/classification-admin.js (new)
- dist/matching.js
- dist/match-view.js
- dist/ai-recognition.js
- dist/supabase-adapter.js
- dist/shared.js
- dist/index.html
- dist/i18n.js
- dist/workspace-theme.css
- server/app.py (local test/development static routes and v2 metadata validation)

Edge Function:
- supabase/functions/recognize-order/index.ts
- supabase/functions/recognize-order/match-profile.ts
- supabase/functions/recognize-order/classification-handler.ts (new)

Migration:
- supabase/migrations/202611110001_job_taxonomy_v2.sql (new; run after the existing matchProfile validator migration)

Tests and documentation:
- tests/matching.mjs
- tests/matching-ai.mjs
- tests/matching-edge.ts
- tests/classification-v2.mjs (new)
- tests/job-taxonomy.mjs (new)
- scripts/matching_smoke.py
- scripts/classification_admin_smoke.py (new)
- package.json
- docs/matching-rules.md
- docs/recognition-rules.md
- docs/update-log.md
- docs/classification-v2-release.md (this report)

## Actual synthetic outcomes

Synthetic male worker, age 26, one 2021–2026 repair-worker history at a synthetic appliance-repair employer, no duties/intents, electrician and elevated-work certificates. Mocked AI assigns appliance-repair history and canonical certificate subcategories. These scenario jobs have no additional scored conditions:

| Job | Actual score | Grade/result |
| --- | ---: | --- |
| 家电维修技工 | 100 | High |
| 电工 | 69 | Medium |
| 吊机维修员 | 69 | Medium |
| 码头机械技术员 | 69 | Medium |
| 升降台操作员 | 35 | Low, certificate evidence |
| 点心厨师 | — | Excluded; kitchen versus maintenance majors shown |
| Synthetic rare/unclassifiable role | — | Manual Judgment |
| Female-only maintenance role | — | Excluded by gender |

Separate regression: literal repair-worker history versus repair-worker job, no AI, employer industry available, salary stated but worker salary missing: **70 / Medium**, never excluded. The title-only variant remains a same-subcategory candidate. Additional ordinary job conditions can change totals; these values are not predictions about real records.

## Verification results

Passed with local synthetic data and mocked model responses only:

| Command | Result |
| --- | --- |
| npm run check | Pass |
| npm run test:parser | Pass, including classification-v2 and matching-AI tests |
| npm run test:transport | Pass, including both model providers, embedded classification and independent quota |
| npm run test:postgres | Pass, existing portability/permissions plus taxonomy RLS/quota/claim/merge/backfill tests |
| npm test | Pass, 10 backend tests |
| python3 scripts/smoke.py | Pass |
| python3 scripts/workflow_smoke.py | Pass |
| python3 scripts/matching_smoke.py | Pass in America/Toronto and Asia/Shanghai |
| python3 scripts/classification_admin_smoke.py | Pass |

New checks cover new-name reuse, immediate availability, valid/invalid evidence and majors, stale v1/source hashes, merge chains/cycles, admin cache priority, fifty independent quota reservations, service-only writes, ordinary-employee management denial, concurrent hash claims, twenty-item deduplication, interrupted/cached resume, metadata-only saves, worker/order version conflicts, bilingual UI and mobile overflow. No real DeepSeek/Gemini request, applicant or live order was used.

## Hosted status and owner steps

Implementation and local verification are complete. GitHub Pages frontend release is tracked separately by its deployment workflow. **Supabase migration and updated Edge Function have not been deployed from this environment. No production backfill has been run. Production classification coverage is unmeasured.**

The selected environment reports no deployment credentials/identity and no Supabase CLI. It therefore cannot export the authenticated real job-title inventory, apply SQL, deploy the function, or verify live quota counters. A successful frontend deployment does not imply those backend operations occurred.

Owner deployment sequence:
1. If not already installed, execute 202611100001_match_profile.sql first.
2. Execute 202611110001_job_taxonomy_v2.sql in the authorized project's SQL Editor.
3. Deploy recognize-order with its validation.ts, match-profile.ts and classification-handler.ts dependencies through the authorized Supabase pipeline. Keep all service/model keys server-only; existing model/origin settings stay in effect.
4. Open Matching → Classification Management as administrator. Export the title-only inventory, audit the eighteen-major coverage, then run backfill. Resume after any quota/transport interruption; completed caches are retained.
5. Confirm other plus unclassified falls below five percent, inspect the real repair worker's results and ten excluded pairs, and verify actual quota increments. Those live acceptance steps are outstanding.

## Differences and limitations

- The final code vocabulary has all eighteen requested majors (listed in matching-rules.md), but **was not finalized against a real database export** because authenticated read access is unavailable. Synthetic coverage is not a substitute. The owner-facing export/action makes that audit concrete.
- Existing test scenes remain. Two old expected outcomes necessarily change under the explicit new rules: hotel-room cleaning versus general cleaning is same-major/different-subcategory (85, medium); packing versus warehousing is cross-major without a relevant occupational certificate and is excluded. Their old high/low outcomes would contradict the requested v2 semantics; unrelated parser/privacy/boundary assertions were retained.
- Unknown stated conditions still contribute zero if every condition is unknown, following the previously agreed conservative F behavior; unknown items otherwise remain excluded from its mean. This can reduce a related job to low while retaining it as a candidate.
- New AI names may be near-synonyms; administrator merging/alias cleanup is intentional. Generic text can have only a major, and empty/rare input may still require manual judgment. Standard certificates map occupations, not independently verified licensing validity.
- The cache keeps literal evidence and hashes, not full input records. Source fields over 12,000 characters or request bodies over 64 KiB safely fail; very large backfill inputs may need smaller batches. Reservations remain spent on a provider failure after reservation, preventing failed-call quota bypass.
- Shared taxonomy tables require the project's ordinary database backup process; the existing portable business export was not extended to export taxonomy tables. Imported business records can fall back to rules until taxonomy is restored/rebuilt.
- SQLite development mode does not expose a production-equivalent taxonomy store; admin service tests mock that transport and real PostgreSQL tests verify the migration/security. No live authenticated site walkthrough is claimed.
- Private design-preview files remain separate and are not part of this release.
