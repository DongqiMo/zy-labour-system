# Worker-to-job matching

The November 9 replacement task supersedes both the original five-weight scorer and the intermediate R/F/critical-language proposal. Matching is advisory, never a publication validator. No language grade cap applies.

## Inputs and eligibility

Use `orderState(record) === 'ready'` and `orderPublication(record).order`; never parse archived raw again. The default inclusive China-date window is 14 days (7/14/30 selectable). Age prefers birth date over entered age and uses `ZYTime`/Asia/Shanghai; all periods and ranges use the same clock.

Gender or age mismatch excludes an order without scoring. Any age excess excludes, even one year. Unparseable/missing demographic values pass with a visible review notice. Related work experience is the third hard gate. Same-category intent without related history produces the distinct reason `意向相符，但没有相关工作经历`. No history produces a request to complete registration instead of scoring.

`job-categories.js` is independent data, including cleaning, hotel_housekeeping, kitchen_helper, cook, care, warehouse, packing, office, sales, driver and construction. Multiple literal categories are allowed; title is preferred to duties. Related-category edges are explicit. Unknown vocabulary is not guessed from shared generic words. An extra registered Hong Kong employer is a supplemental history if it is not duplicated; hotel employer hints can classify that supplemental history only.

## Experience E

Each related history scores `100 * relation * duration * recency`. Same category is 1, related is 0.5, unrelated 0. Periods support year/month separators, Chinese dates, current employment and year-only approximate periods. An unparseable period explicitly assumes 12 months and recency 0.7, marked unknown. A supplemental Hong Kong exit date can refine recency.

Duration factors: below six months 0.4; six months 0.5; twelve 0.7; twenty-four 0.9; thirty-six or more 1. Interpolate linearly between anchors. Recency: within five years 1; through ten years 0.7; older 0.4. E is best history plus 0.25 times second-best, plus 10 if a contributing history is in Hong Kong, capped at 100. Highlight both contributing history indexes. Certificates do not add E points.

Periods use elapsed calendar months, with a minimum of one month for a same-month history. March 2019 through August 2023 is 53 months (4 years 5 months), matching the task example. Current histories end in the current China calendar month.

## Conditions F

Only conditions actually stated in the company language/requirements/notes or validated profile participate. Each language AND group counts once; an OR group takes a satisfying alternative, otherwise remains unknown if an alternative is unknown. Levels: fluent/skilled 4, good/can speak 3, ordinary/basic/simple/bare language 2, understands/little 1, none 0. Meet requirement = 1, one short = 0.6, two or more short = 0. Languages never cap a grade.

Salary takes the first amount; w/万 means 10,000. Unlabelled worker expectation defaults to HKD; an offered unlabelled currency is unknown. Only equal recognized currencies are compared, without exchange rates. Expectation at/below salary = 1; up to 10% above = 0.6; otherwise 0. Currency mismatch is displayed but does not make F applicable by itself.

Height/weight use explicit numeric minimum/maximum. Education ranks primary < junior secondary < senior secondary/vocational < college < bachelor. Health recognizes affirmative healthy/good wording with negative-word checks. Stated certificate keywords are compared to registered certificates. Known meets = 1, fails = 0. Missing worker information is excluded and listed, never awarded half points. F is the equal mean of known conditions times 100. No conditions (or only incomparable currency) means F does not participate. If stated conditions exist but every worker value is unknown, F displays pending and contributes zero conservatively.

## Preference and grades

Same-category first/second/third preference adds 10/7/5; related category adds half; use the maximum, never sum or penalize. Total is rounded `0.7 E + 0.3 F + bonus`, capped at 100. When F does not participate, total is `E + bonus`.

High requires same-category history and total >=75. Medium requires total >=50; related-only experience can never be high. Others are low. Missing-condition notices do not impose grade caps. Within groups, sort by score then newest creation instant.

Synthetic November 9 results: hotel 100 high; cleaning 100 high; Cantonese kitchen 84 high; fluent-Mandarin kitchen 78 high despite one-level language gap; warehouse 20 low; care excluded for no related experience; male chef excluded by gender; office excluded by age and history.

## AI classification and persistence

AI never returns scores or grades. `sourceFor` projects job fields or worker intents/history positions/duties/certificates; worker names, phones, addresses, identity numbers, employers and photos are not sent. There is no new registration consent text per the replacement task. Classification uses the authenticated `recognize-order` Edge Function, existing membership/CORS checks and atomic `zy_ai_reserve` quota reservation.

Order classification accompanies the existing recognition call, adding no request. Worker save calls classification once only when classification-source fields changed (or on first registration). Failures do not stop saving. Manual Reanalyse is available for stale worker/order profiles. Existing orders are not bulk backfilled. Availability is capability-gated: an old deployed function without `classification:true` results in rule-only operation.

`matchProfile` is independent current metadata: version, sourceHash, AI/rules source, timestamp, categories and literal evidence. FNV-1a source hashes are deterministic cache invalidation keys, not authentication. Every category must be in the vocabulary; evidence must occur in its specific input row or order; typed requirements are checked on server and client. Invalid, stale, quota-limited, failed or timed-out responses fall back to rules. Empty/unclassified worker rows also retain rule fallback. `AI` labels indicate classified evidence used by scoring. No history copies, training, firstRecognition resurrection or automatic rewriting of business fields.

Deploy `202611100001_match_profile.sql` before the updated Edge Function. It permits only the bounded matchProfile object in the existing validators, introduces no table or policy and retains revision/worker-version checks and the snapshot-stripping trigger. Frontend updates alone do not deploy Supabase.

## UI, privacy and performance

Desktop results/profile, tablet disclosure and mobile tabs share the scorer. Selection searches name/phone suffix with 200 ms debounce. Expand one order for experience, condition and intent evidence, linked profile highlights and company-only copy. Phones are masked until explicit reveal; identity/address/permit/alternate-contact fields are excluded from matching and its registration preview. Read-only accounts gain no write controls. Dirty registration navigation retains its warning.

Only ephemeral bounded Maps cache results by worker projection, order revision, range and China date; no results are persisted or exported. Sync retains worker selection/open job, and logout removes matching DOM/cache. Business values are protected from interface translation; generated reasons use translated templates and protected variables.

At narrow desktop widths, the fixed specification columns scroll inside the left panel instead of overflowing the page. Phone rows remain compact with accessible 44px controls. Unknown category vocabulary and arbitrary free-form period spellings remain limitations; use explicit editing/reanalysis, never inferred experience.

## Verification and release limits

Synthetic tests: matching.mjs, matching-ai.mjs, matching-edge.ts, matching_smoke.py in Toronto/Shanghai, existing syntax/parser/transport/PostgreSQL/form/workflow/list regressions. No real applicants/orders, no model calls, no production writes. Hosted migration/Edge deployment and real quota counting require configured Supabase deployment access and separate verification; do not infer them from passing local mocks.
