# Matching rules: occupation classification v2

The November 10 occupation-classification task replaces the closed eleven-category matching dictionary. Scoring stays deterministic; AI classifies occupations only. Source recognition, human ownership, company publication, fee calculation and worker/order write permissions retain their contracts.

## Majors and shared subcategories

The final code vocabulary for this implementation is:

| Code | Major |
| --- | --- |
| kitchen | 厨房餐饮制作 |
| food_service | 餐饮楼面服务 |
| hotel_cleaning | 酒店与清洁 |
| care | 护理与照顾 |
| maintenance | 维修与技术 |
| equipment | 机械设备操作 |
| driving | 运输驾驶 |
| logistics | 物流仓储搬运 |
| manufacturing | 生产制造与包装 |
| construction | 建筑与装修 |
| retail | 零售与销售 |
| beauty | 美容与个人护理 |
| vehicle_service | 汽车美容与洗车 |
| aviation_transport | 机场与交通服务 |
| office | 办公文职 |
| security_property | 保安与物业 |
| agriculture | 农林牧渔 |
| other | 其他 |

These eighteen majors match the supplied draft. This environment cannot export authenticated production titles, so their completeness against the real inventory is **unverified**. The management page includes a title-only export for the owner to audit; do not substitute synthetic title coverage for the required live inventory review.

Subcategories are shared rows, initially seeded for common occupations. Every row has a stable ID, major, standard Chinese name, aliases, new/active status and optional merged_into. New AI proposals are inserted immediately as new and usable; an existing normalized name in the same major reuses the row. IDs resolve through merge chains at match time, so old profiles need not be rewritten. Cycles and self-merges are rejected. Names are business content and are not translated.

AI receives fixed majors and existing unmerged dictionary entries, must reuse a suitable existing ID, and can propose a new name with literal evidence. Unknown major codes, nonexistent IDs, cross-major ID misuse or nonliteral evidence are discarded. A fallback first uses job title/duties and existing subcategory names/aliases; employer industry helps classify history when needed. More specific title aliases take precedence over employer clues. Unknowns are other, not invented occupations.

## Profiles, privacy and shared caching

`matchProfile.version` is 2. Version 1 and changed sourceHash are stale. Current profiles contain major, subcategory_id, evidence, source, timestamp and sourceHash; workers have indexed intent/history arrays and occupational-certificate classifications. Valid shared cache assignments take precedence, especially administrator assignments. Source hashes include history employer and period changes. Hashes are cache keys, not credentials or signatures.

The normalized shared cache hash is SHA-256 over kind and normalized title/duties (plus employer for histories). Cache rows contain hashes and classification/evidence only, never full source records or applicant identity fields. Input text/evidence is checked again when reusing a normalized cache. In-memory bindings are bounded and cleared on logout. Matching results themselves are never persisted or exported.

Classification transport allowlists order title/workContent/requirements and worker intent text, history position/duties/**employer**, and certificates. Employer names are explicitly authorized in the new task. Do not send worker names, telephone numbers, identity documents, addresses or photos. General health certificates do not imply an occupation. Empty history position and duties skip AI even if employer exists; local fallback may still use employer industry. Fields longer than 12,000 characters and transport bodies over 64 KiB fail safely rather than being silently truncated.

## Hard conditions and relevance

Gender/age mismatches exclude without score, even one year outside the stated range. Unknown demographics retain manual notices. All dates and ages use `ZYTime`/Asia/Shanghai; stored instants remain UTC. Period parsing, elapsed calendar months, duration anchors/interpolation and recency are unchanged.

For each real history versus job:

- Same resolved subcategory: relevance 1, potentially high.
- Same major, different or unknown subcategory: relevance 0.6, at most medium.
- Cross-major without relevant certificate: unrelated.
- Either relevant side other/unclassified: Manual Judgment, not an unrelated-history rejection.

If at least one history has the job's major, it remains a low/medium candidate even if very short/old. If some histories are unknown and none establishes a relation, defer judgment instead of claiming no relevant history. Gender/age exclusions still take precedence. Rejection messages include the job and worker majors.

Each occupational certificate matching the job subcategory or major adds an experience candidate worth `100 * 0.5 * 0.7 * 1 = 35`. Certificate-only matches cannot be high. Known fallback certificates cover electrician, welder, elevated work/lift platform, forklift, driving, cook and care/nursing. Health certificates do not count. Certificates still contribute to F when explicitly required by the company.

## E, F, intent and grades

E is the best real/certificate experience plus a quarter of the second-best, with a 10-point Hong Kong bonus when a contributing real history is explicitly Hong Kong, capped at 100. Real histories use `100 * relevance * duration * recency`. Duration: below six months 0.4; six months 0.5; twelve 0.7; twenty-four 0.9; thirty-six+ 1, with linear interpolation. Recency: through five years 1; through ten years 0.7; older 0.4. Unparseable periods use twelve months and recency 0.7 with a visible question mark. Histories known to be Hong Kong through the explicit HK employer field also qualify for the unchanged bonus.

F remains the equal mean of explicitly stated, judgeable language/salary/physical/education/health/certificate conditions. Unknown worker values are excluded, not awarded points. Languages never cap grades. Salary compares only equal recognized currencies, without exchange rates; up to 10% above offered salary earns 0.6. OR languages take an alternative, AND groups remain separate conditions. No applicable condition means F does not participate. If stated conditions exist but all values are unknown, F displays pending and contributes zero conservatively, retaining the previously agreed behavior.

Intent first/second/third adds 10/7/5 for same subcategory, half for same major, maximum one bonus. Intent mismatch never deducts and cannot substitute for history/certificates.

Total is rounded `0.7 E + 0.3 F + intent`, capped at 100; without applicable F, `E + intent`. High requires actual same-subcategory history and total >=75. Medium requires total >=50; same-major/certificate-only is capped at medium. Remaining related candidates are low. Manual Judgment has no numeric score/grade and appears after low, before excluded.

## AI invocation, quota and resumable backfill

Standalone classification runs through authenticated recognize-order actions, using the existing CORS/membership boundary and server-only service/model credentials. It uses `zy_job_reserve`, not `zy_ai_reserve`: default fifty team calls per China day, atomically reserved and owner-adjustable in job_classification_settings. DeepSeek temperature is zero; Gemini's major is an enum, subcategory is an extensible string. Inputs are data, never executable instructions. Failed, timed-out, unavailable or limited classification falls back to local rules and then Manual Judgment when necessary.

New recruitment recognition can return classification alongside facts without a second model call. Classification persistence/reservation failure drops metadata alone, preserving validated recognition facts. It cannot rewrite the salary, fee, code, original or human fields. Changed worker classification inputs trigger at most one save-time request; a classification failure does not block save. Manual Reanalyse forces a refresh of AI/rules cache entries but preserves administrator assignments.

Admin backfill deduplicates eligible ready-order texts and worker histories/intents/certificates, skips shared cache hits, and sends sequential batches of at most twenty. First failure/missing result/quota denial stops; committed caches remain for resume. Once results are available, profile patches are applied in bounded, order-revision/worker-version checked transactions. Only matchProfile is updated, not timestamps or other business fields. An edit conflict stops rather than overwrites. Service-only ninety-second hash leases prevent simultaneous uncached requests from issuing duplicate model calls; a busy response falls back safely and can be retried after the first result is cached. Leases are released after success/failure and expire after interrupted requests.

## Authorization and deployment

Migration 202611110001_job_taxonomy_v2.sql adds the two public tables plus private quota/settings/lease tables. RLS permits active team members to read public classifications and caches. Direct client writes are revoked. AI creation/cache writes require service-role-only functions that recheck the actor and maintenance mode. Admin-only management handles confirm/rename/aliases/major changes/merge/manual assignments; admin-only profile backfill retains business revisions. The firstRecognition-strip trigger remains installed and classification roundtrips are tested alongside it.

Deploy in order: the earlier matchProfile validator migration if absent, then the v2 taxonomy migration, then recognize-order with validation.ts, match-profile.ts and classification-handler.ts. Supabase automatically supplies its server-only service key to the function; never put it in frontend config or chat. The browser requires classificationVersion:2 before standalone v2 AI calls. Missing deployment falls back to rules; the admin page clearly disables unavailable shared operations. SQLite development mode currently exercises admin AI through synthetic mocks, not a production-equivalent shared taxonomy store.

No deployment credentials are configured here. Hosted migration/function deployment, live-title export/audit, real backfill, below-five-percent coverage acceptance and real-account matching checks are owner/environment follow-ups, not completed by local tests. The public frontend may use broad fallback without those hosted components.

## Verification

Synthetic tests cover repair/technical cases, certificate-only relatedness, unknown/manual handling, exact age/gender rejection, v1 expiry, employer redaction allowlist, new names, alias reuse, merge chains/cycles, manual cache precedence, both model providers, independent quota, service-only writes, administrator management and revision-safe metadata backfill. Browser regression covers groups, sources, copy/privacy, mobile layouts, bilingual major names, persisted selection, twenty-item interrupted/resumed backfill and unchanged business fields.

Expected new repair example, no company conditions and using mocked AI subcategories: appliance 100 high; electrician/crane repair/mechanical technician 69 medium; elevated work 35 low; kitchen excluded; rare role manual. Generic repair-worker versus repair-worker with AI unavailable and unknown expected salary remains 70 medium when the offered salary is stated, rather than being excluded.

The old test scenes remain with unchanged parsing/privacy/boundary checks. Two outcomes intentionally change under the requested semantics: room-housekeeping versus general cleaning is now same-major/different-subcategory (85 medium); packing versus warehouse is cross-major without an occupational certificate and is now excluded. Keeping their old high/low scores would violate the new rules.
