## Editable company fee notes

- Generated fee notes are now editable in single, edit and batch forms. Explicit edits persist as a separate scalar customFeeNote and are used verbatim in company publication, including after reopening or changing salary.
- Explicit w/万 amount edits synchronize the existing internal company amount without changing its calculation formula. The separate amount dialog updates the amount inside a custom note; automatic notes retain existing behavior.
- Dirty-form snapshots include manual note edits. Existing notes remain generated until edited; no migration or hosted backend change is required.

## Experience-first worker-to-job matching

- Implemented the November 9 replacement task: hard gender/age/related-history gates; best plus quarter-second experience with duration/recency/Hong Kong factors; equal observed-condition average; 10/7/5 preference bonuses; 70/30 totals and same-category high-grade requirement. Languages do not cap grades. Missing history requests completion.
- Added matching navigation, worker-row/save-success entries, desktop linked results/profile, tablet disclosure, mobile tabs, company-only copy, search/ranges/filters, translated evidence and missing-data notices. Sync retains selection; caches are bounded and memory-only; unsaved registration guards remain.
- Added allowlisted, evidence-checked AI classification through existing authenticated/quota-controlled recognition. Recognition returns classification within its existing request; changed worker classification inputs trigger at most one save-time call. Failures preserve save; stale profiles use rules and offer reanalysis. No business-field or price/publication-rule rewrite, consent text change, extra history snapshots or live-data backfill.
- Added a bounded independent matchProfile validator migration for existing records; no new tables, privileges or policies. Deploy migration before Edge Function. Old hosted functions without classification capability continue rule-only matching.
- Added synthetic scorer/AI/Edge/PostgreSQL and two-timezone browser checks, preserving existing form/workflow/list assertions. Full rules, month-count convention, actual example scores, responsive compromises and deployment limitations are documented in matching-rules.md.

## One China business timezone

- Added cached browser/Node `ZYTime` helpers for China dates/parts/display, UTC-only day/month/week arithmetic and literal-date validation. All business date logic now uses this shared utility.
- Unified company-code dates/sequences, Today/week filters, date groups/calendar counts/highlights, displayed review times, login/list header dates and backup filename dates. Displayed times identify China time in Chinese/English.
- Replaced the calendar's local Date month with a year/month object. Worker ages use China's current day without converting birth/exit dates; the existing explicit-age preference remains unchanged.
- Updated the existing narrow legacy V-code repair to use the China year, with counterexamples for valid current codes, invalid calendar dates and timestamp/source immutability. Recognition rules and parser metadata version remain unchanged.
- Preserved UTC timestamp storage, existing company codes/history, prices, publication text, manual ownership, permissions, elapsed-time clocks and Supabase quota logic. No live-data migration or Supabase deployment is required.
- Added Node boundary/leap-year/DST-invalid-input coverage and synthetic frozen-clock browser acceptance across Toronto, Shanghai and Auckland, alongside existing parser/workflow/list regressions.

## UI/UX batch four: unified compact order workspace

- Merged Today and Database into one Orders workspace with canonical `filters.orders` and today/week/all/date ranges. Existing `go('dashboard')` and `go('orders')` remain range aliases. Replaced large cards/counters with a 52px desktop grid, date groups, state chips and a persistent detail pane; retained the shared publication state/cache and existing business actions.
- Added 200ms debounced position/code/employer/salary search, date-range counters, the existing calendar with today highlighting and default collapse, and remembered All-range date groups. Implemented the earlier taskbook's 3.1, 3.3 and 3.4 in this batch.
- Added company/source/recognition tabs with read-only embedded provenance, existing human-review confirmation and fee dialogs, reviewer metadata, exact publication blockers, and contextual menus with deletion last. Kept selection, tabs, scroll and keyboard focus during list refreshes; retained filters/selection when returning from edits and selected new single/batch records on today's list after save.
- Replaced the old top header with the compact sidebar shell; moved language/account controls to its footer and a discoverable mobile My Account menu. Added a three-item 68px phone navigation, floating creation button and raised toast placement.
- Added native modal details: right drawer below 1100px and bottom sheet below 640px, with Escape/backdrop/close handling, keyboard focus containment/restoration, accessible tabs, reduced motion and shared color/size tokens. Phone controls use at least 44px hit areas and 12px text even where smaller visual dimensions were suggested in the design.
- Updated old browser selectors for rows, merged headings/ranges, chips, relocated language controls and calendar launching; retained their original business and permission assertions. Added dedicated synthetic list acceptance for layout, dates/counts/search, state actions, menus, sync/edit retention, keyboard focus, 375/390px layouts and English data protection.
- Recognition, pricing, publication wording, validation, manual ownership and authenticated persistence remain unchanged. No live data is modified and no Supabase deployment/migration is required. Other unrequested batches remain deferred.

## UI/UX batch one: consistent publication states and unsaved-content protection

- Unified badges, four today counters, status filtering and copy authorization around amount plus the existing publication validator. Kept persisted status and historical/manual review precedence; cached presented/validated records by content and exposed exact blockers in company details.
- Added ephemeral single/edit baselines and native leave confirmations, destructive worker replacement checks, explicit logout protection and browser refresh/close warnings. Preserved batch/worker buffers across ordinary navigation without prompting; automatic successful-save navigation bypasses the guard. No browser draft storage was added.
- Replaced immediate human-review writes with a review dialog, shared exclusion reasons, hypothetical-metadata blocker checks and a separately serialized confirmation write. Added reviewer/time display with legacy label-only fallback.
- Removed only the repeated position-label line from publication. Fee calculation, amount UI, fixed fee wording, recognition behavior, permissions and live records remain unchanged.
- Added synthetic local-browser coverage for all three display states, filters/counts/copy, cache invalidation, legacy review tokens, review cancellation/blockers/business-field preservation, no-extra-items and English notices, hidden-field dirtiness, single/edit cancellation, batch/worker buffer retention, native refresh protection, logout cancellation and successful save navigation. Existing parser and full browser smoke coverage remains required.
- Batch two/three changes are deferred. No Supabase deployment or migration is needed; no live-data tests are performed.

## Show only the automatically generated fee note in entry forms

- Removed the visible numeric fee-amount row from shared single/batch/edit form rendering. Only the read-only generated fee note is shown.
- Retained the internal price value, existing suggestion formula, salary-change calculation, persisted manual amounts and company publication format. No business-record migration is introduced.
- Verified hidden internal amounts, visible generated notes and normal single/batch save/edit behavior.

## Automatic fee-note preview and complete self-audit removal

- Added a read-only generated note beside the numeric fee amount in single/batch forms. Salary suggestions and manual numeric changes refresh the full note; publication uses the same generator and existing fee calculation.
- Accepted legacy fee values accidentally containing the fixed wording, extracting their explicit w/万 amount for normalisation rather than losing the fee.
- Removed the global source self-audit button, count, module, background invocation and export entry points. Ordinary source review/manual confirmation remain.
- Historical `firstRecognition` cleanup remains revision-protected on workspace entry; the supplied hosted SQL migration is still required for a direct database purge and legacy-client write prevention. No hosted execution or immediate physical disk-space reduction is claimed.

## Retire extra recognition snapshots and publish the company fee as a note

- Stopped capturing original-input/first-machine copies in single/batch/re-recognition and removed the snapshot download. Retained ordinary source records, human edits, current evidence and review ownership.
- Added idempotent revision-checked workspace cleanup of legacy `firstRecognition` fields and stripping on writes/imports/new exports. Prepared and locally tested a hosted SQL cleanup/trigger that prevents old clients restoring snapshots; hosted execution remains an owner step. Existing downloaded/provider backups are not claimed erased.
- Replaced ZY all-inclusive-price UI labels with fee-note labels. Preserved the automatic suggestion formula and manual overrides; display and new saved input use `x.xw`.
- Company copy now ends with `备注：劳务，服务费管理费：x.xw全包` and `以上内容仅供参考，具体信息以面试为准`.
- Verified source preservation, no new snapshots, historical snapshot-only cleanup, manual edits, fee publication, permissions and existing database roundtrips.

## Entry-mode document boundaries

- Single-entry recognition now treats the complete submitted source as one document; repeated supplier identifiers, decorative rules and footer role summaries no longer trigger a multi-document rejection before AI assistance.
- Existing-order re-recognition previews respect the selected record boundary. Batch entry continues to split only on explicit staff separators.
- Retained literal evidence, within-document conflict checks, fee filtering, source archives and manual-save ownership. Added synthetic repeated-footer and explicit-batch counterexamples plus browser coverage.

## Order-list visual hierarchy and button feedback

- Added a pale blue-grey workspace background, alternating quiet order-card surfaces, clearer borders, left-edge accents, spacing and restrained shadows.
- Strengthened code/title hierarchy and kept secondary metadata readable. Source and company disclosures now use distinct surfaces; date groups have a separate header and explicit expanded styling.
- Added 180ms hover/press feedback for mouse users, visible keyboard focus, disabled/loading exclusions and reduced-motion support. Mobile cards stack price information without relying on hover.
- Changed presentation styles and scoped card classes only; ordering, filters, collapse ownership, recognition and persistence remain unchanged.

## Smooth recognition waiting animation

- Replaced stage jumps with a slow, CSS-interpolated waiting animation capped below completion. The displayed percentage is explicitly simulated; only an applied result reaches 100 percent.
- Stopped animation on success, failure, discarded late responses and detached views. Retained duplicate-click prevention, human-edit ownership and reduced-motion support.
- Updated browser acceptance to verify movement while a mocked AI call is pending and completion only after successful application.

## Recognition stage progress and Cantonese duration units (parser v17)

- Added a percentage/progress indicator beside the single-entry Auto Organise button, with reading, rule extraction, AI connection/waiting, checking and completion states. Percentages describe stages, not measured model computation, and do not advance on a timer.
- Disabled repeated clicks during requests; restored the button on success, failure or discarded late results. Concurrent human edits remain intact and discarded operations never display 100 percent.
- Recognised Cantonese 个钟/個鐘 durations in offline rules and both AI evidence gates. Currency suffixes such as synthetic `24000hk` do not qualify as hour units.
- Added synthetic duration/currency counterexamples and browser progress/duplicate-click/manual-edit checks. Hosted `validation.ts` must also be updated for the server-side duration gate; frontend and rule changes deploy through Pages.

## Fresh-draft AI precedence and compound supplier identifiers (parser v16)

- Fixed AI assistance only filling empty fields: validated literal facts now replace incorrect populated rule guesses in fresh machine drafts, while differences remain visible for review.
- Guarded persisted and human/manual-marked records against in-place AI merging. Existing async form ownership checks and explicit preview/save remain in force.
- Recognised compound supplier identifiers such as synthetic `AS-HK0826`, preserving the supplier prefix without treating identifier digits as wages or its letters as a job.
- Suppressed generic interview disclaimers in assisted drafts. Retained rule review warnings rather than claiming all unclassified source fragments are resolved.
- Added synthetic regression and nearby currency/manual-ownership counterexamples. No live order sources entered the public repository.

## Optional DeepSeek recognition provider

- Added server-selected DeepSeek support to the existing authenticated Edge Function; API credentials remain server-only, using the existing atomic request quotas and source masking.
- Added an 8192-token completion ceiling, explicit truncation rejection, no automatic retry and a 90-second upstream timeout.
- Allowed DeepSeek facts through the same source-evidence checks, manual-preserving merge and provider-tagged first-machine archive. Preserved explicit MOP salary evidence and blocked supplier base-price evidence.
- Added mocked provider/format/failure tests and deployment instructions. Hosted activation and real production-prompt acceptance remain owner setup steps; local API trials are not claimed as live website validation.

## Optional Gemini assistance (rule parser v15)

- Added a separately enabled Supabase Edge Function with active-member Auth checks, CORS, a fixed structured extraction prompt/schema, literal source validation, contact/identity masking and server-only key handling.
- Added private atomic reservations: 20 calls per member/day, 100 team/day and two-second member cooldown; maintenance and disabled membership prevent calls. No source text or API keys enter counter tables.
- Integrated optional assistance into explicit single/batch/re-recognition actions. Rules remain available when AI is absent, disabled, exhausted or unavailable. No Google requests occur on background audits or worker forms.
- Gemini fills missing fields and flags differences while preserving populated values, company code, independent ZY price and manual edits. Pending responses cannot overwrite forms changed during the request.
- First recognition snapshots record the actual provider/model. API secrets and hosted activation remain a separate owner setup; Pages deployment does not enable the external service.
- Added mocked Gemini, transport, literal extraction, quota/permissions and pending-response browser checks. Real Google calls are not claimed as tested.

## Audit-derived recognition fixes and first-machine archives (parser v14)

- Fixed clock ranges being treated as ages; retained spaced/approximate age qualifiers and ages embedded in schedules.
- Added missing position/requirements/accommodation/contract labels, closing-only field brackets, and named establishment types. Experience descriptions mistyped as positions no longer create false title conflicts.
- Normalised invisible extraction controls on the recognition copy, preserving archived source/review fingerprints and full salary ranges. Removed flag/chat decorations from company fields.
- Kept employee deductions mentioning base pay in notes, retained earnings components, and removed standalone upstream-fee headings without requiring an amount. Preserved operational duties and prevented generic disclaimers from leaking into duties/hours.
- Added immutable-in-workflow first machine snapshots before form edits. Snapshots persist with successful single/batch business saves and remain unchanged by human edits or re-recognition.
- Audit downloads now export original source plus first machine fields only. Legacy gaps are labelled, never reconstructed; final human company fields are excluded from sample exports and no longer compared as recognition errors.
- Added REC-023–030, first-only export/persistence checks, source-tracked demographic checks, and PostgreSQL/SQLite portable snapshot coverage. No production records are rewritten and no private source documents are committed.
- Unsaved abandoned drafts require a separate backend archive endpoint and are not covered by persistence-on-save.

## Collapsed calendar and today's date indicator

- The database date finder starts collapsed each time the page is entered.
- Today's local date has a blue background/border and semantic current-date marker, separate from the selected date.
- Selecting dates and moving months retain the open calendar while interacting; existing filters remain available.
- Browser verification covers entry/re-entry, today versus another selected date, and month changes.

## Return to the originating list after editing

- Editing from Today's Overview now returns there after a successful save or Return to List.
- Editing from the Order Database returns to the database; existing search/status/date filters are retained.
- New-order saves retain their existing destination. Failed saves continue to keep the editor open.
- Browser coverage verifies both edit origins, cancellation, persisted changes, and filter retention.

## Source-evidence identity recognition (parser v13)

- Added a document-wide position/employer candidate pass before clause routing. Values are literal source excerpts with offsets, evidence rank, and reason; no names or duties are generated.
- Removed mandatory title-vocabulary gating for wage-attached and recruiting headings; unique corroborated unlabelled headings also support unfamiliar positions.
- Split employer/position/wage hiring sentences and kept adjacent demographic facts independent. Explicit labels outrank weaker headings; equally strong conflicting employers remain blank for review instead of being concatenated.
- Replaced the previous inline title/employer routing branches. Retained source-price confidentiality, salary formatting, human review, manual code ownership, and preview-before-save for old records.
- Batch entry now respects staff-provided standalone `---` boundaries without additional inferred splitting. Single-entry multi-order protection remains; unfamiliar compact wage headings also work there.
- Updated REC-014 to the new literal-extraction contract and added REC-018–022, 96 identity/currency/order variants, exact evidence-span checks, negative examples, and browser single/batch checks.

## Manual code ownership and vehicle-repair recognition

- Fixed supplier provenance forcing removed suffixes back into company codes on save/display.
- Initial recognition still suggests supplier letters; subsequent single/batch edits and re-recognition preserve the entered code.
- Added simplified/traditional vehicle-repair trade headings, qualification cues, and provided-housing notes. Unknown facts remain for review; no employer or duties are invented.
- Added synthetic regression family REC-017, repair/currency variants, certificate counterexamples, and browser persistence checks for removed/replaced supplier suffixes.
- Existing business records are not bulk rewritten.

## Order database date folding

- Group database orders in date sections, newest first, collapsed by default.
- Display each date and its matching order count; expand dates independently and retain expansion during list refreshes.
- Preserve job/code search, status/calendar filters, and the daily overview layout.
- No business records or recognition rules are changed.

# Website Update Log

## 2026-11-03: Urgent fix for completed human reviews (parser version 11)

- Root causes: review tokens included the parser version, so upgrades invalidated old confirmations; raw-parser disagreement and audit comparisons could overrule manually corrected company orders.
- Review fingerprints are now independent of parser versions, with compatibility for historical version-prefixed tokens. Genuine source changes still invalidate the source confirmation.
- Saving an existing company order is the human-review action: it records durable review source, timestamp, and reviewer metadata and immediately enables valid company text and copying without another checkbox.
- Existing confirmation tokens and persisted meaningful manual-field edits are recognized as review evidence. A ready price status alone is not assumed to prove human review.
- Human-reviewed orders are excluded from parser-uncertainty warnings and audit re-review counts. Required company fields, code validity, and upstream-price confidentiality checks remain active.
- Added a one-click Mark as Reviewed action for historical records lacking review metadata; it preserves company fields and original source while storing confirmation metadata.
- Added REC-016 and regression coverage for old tokens, manual-save publication, audit precedence, source-change invalidation, and unchanged fee/required-field checks. Parser and full browser acceptance checks passed.

## 2026-11-03: Source audit, compact-role recognition, hours-only shifts, and original worker template

### Order recognition and self-audit (parser version 10)

- Root cause of the cleaner-order failure: common trade nouns were missing, the leading HK location was not normalized, and wage extraction was incorrectly coupled to recognizing the role. Market establishment descriptions were also absent from employer cues.
- Added common trade/establishment vocabulary and independent wage evidence for unfamiliar compact role/pay headings. Uncertain titles stay empty and visible for review; wages, duties, employers, or ages are never invented to fill a form.
- Added documented cases REC-013 through REC-015. The catalog now covers 15 error families plus the existing role/currency variants and negative examples.
- Removed the separate Shift option from company forms and publication. Source shift descriptions and legacy shift values merge into Working Hours; existing records are not bulk rewritten.
- Added a read-only audit of seven critical fields: position, employer, salary, gender, age, working hours, and duties. It retains source excerpts, flags missing or unsupported information, compares proposed/current values, and identifies conflicts by company code.
- Audit runs in the authenticated browser after login. The audit dialog can refresh the full current order list, download a private report containing source orders, and enter the existing re-recognition preview. Audit and preview do not write business records. Reports are cleared on logout.
- Production records remain private: the assistant has not independently retrieved the user's authenticated live dataset. A downloaded report can be supplied for manual, record-by-record review.

### Worker registration

- Restored the supplied original blank form background, A4 print coordinates, photo placement, language checks, and overflow appendices.
- Updated date/selection/text controls while keeping existing worker keys, manual values, team storage, and version checks.
- Reintroduced the supplied PDF text/OCR adapter with explicit review before saving and original-PDF versus edited-template preview. Files are limited to 20 MB and 1–20 pages.
- Corrected legacy missing checkbox coordinates, CJK fitting, and adjacent PDF label extraction offsets. Fixed mobile field overflow.
- Retained current authentication and shared persistence; did not import the old local-only storage or offline caching system.

### Verification

Parser regressions, source-provenance/no-fabrication cases, syntax checks, shared-account browser acceptance, read-only audit/report/preview checks, worker template/A4/appendix/import-adapter checks, and API/backup tests passed. External OCR accuracy and CDN availability for real filled PDFs still require deployment-specific review; the automated adapter test uses a deterministic PDF.js boundary.

## 2026-11-03: Whole-document recognition mechanism (parser version 8)

- Replaced the old fall-through classifier with a shared source-span catalog and field assembly pipeline. Each meaningful fragment records its exact excerpt, UTF-16 range, field assignment, disposition, and reason.
- Generic compact role/pay recognition now works across roles and HK currency variants. Removed the food-processing-specific header branch, the unused pre-filter, reverse-substring provenance guesses, and overridden inline single/batch/save/copy handlers.
- Prose summaries can supply age, education, gender, languages, and experience in any row order. Office-document work remains duties; quotation documents, insurance records, and expense reports are distinguished from upstream fees. Physical quantities, including watts, are preserved.
- Review now shows excluded source text with reasons and conflicting/unclassified fragments. Manual corrections refresh warnings without replacing inputs or collapsing the open review panel.
- New-engine records with unresolved fragments can be saved for review, but publication/copy requires explicit acknowledgement. Acknowledgement does not bypass required fields or fee checks; source changes invalidate it. Audit and confirmation metadata remain private and are excluded from publication text.
- Added durable maintenance instructions (`AGENTS.md`), the current recognition contract, a synthetic error catalog covering 12 historical error families, and an executable mechanism suite including 64 role/currency/plus variants, complete span coverage, nearby counterexamples, and duplicate-handler protection.
- Added recognition checks for relevant pushes/pull requests and a mandatory syntax/parser gate in the Pages deployment job.
- Existing business records, source archives, manual values, permissions, calendar/search, and migration tools are retained. No bulk reparse, database deletion, or schema migration is performed. Old-order recognition remains preview/review/save.
- Verification: syntax checks, all parser suites, temporary API/backup tests, and browser acceptance cover the pipeline, independent shared accounts, single/batch review confirmation and invalidation, audit persistence, original-text preservation, publication privacy, calendar filters, language switching, and mobile layout.

## 2026-11-03: Standardized company salary format (parser version 7)

- Company monthly salaries use `HKD15920`, retaining a source trailing plus as `HKD15920+`. Missing HKD prefixes are added; Hong Kong currency aliases, spaces, thousands commas, and redundant monthly suffixes are normalized.
- Allowances and bonuses remain in the salary field; explicit employee deductions remain in notes. Upstream supplier quotations and agency/permit/insurance fees remain excluded.
- Formatting applies to company cards, publication/copy text, single/batch recognition forms, and saved edits. Existing records display the format without a bulk database rewrite; archived source text is unchanged.
- Formatting does not perform exchange-rate conversion or turn hourly/daily pay into monthly pay. Explicit foreign currencies and non-monthly units are preserved.
- Validation: parser cases for optional plus signs, source immutability, repeated formatting, components, and currency/period safety passed. Full browser acceptance checks passed, including the calendar, compound filters, grouped navigation, source review, mobile layout, and existing sharing workflows.

## 2026-11-03: Payroll classification, recognition review, navigation, and order calendar

- Salary now includes the main wage and explicitly stated allowances, bonuses, commissions, and base-pay breakdowns. Amounts and eligibility conditions are retained.
- Employee accommodation, meal, and other explicit payroll deductions go into notes, including their amounts or percentages. Upstream package quotations, agency, permit, and insurance quotations remain excluded. The manually set ZY package price remains independent.
- Both single and batch entry provide an expandable Field Sources and Review Checklist, with original-text excerpts, unclassified content, and missing/ambiguous field warnings. This is an internal review aid, not part of copied company text.
- Existing orders are not automatically reparsed or rewritten. Re-recognize, review, and save to apply the new classification to an existing record.
- Navigation is separated into Labour Orders and Worker Information, each containing its original two direct links, without collapsible menus. Mobile navigation keeps the same two groups.
- The order database adds a monthly calendar showing daily entry counts, previous/next month controls, a date input, and a clear-date action. Dates use the browser's local entry date.
- Search accepts job titles and company order numbers, including partial codes and case-insensitive supplier suffixes. Date, search, and status filters work together; clearing the date preserves the other filters.
- Validation: JavaScript checks and parser regressions passed. New cases cover salary components, employee deductions, fee privacy, repeated sanitization, and review reports. Browser checks cover source excerpts, non-collapsible groups, combined date/code/status filtering, clearing filters, responsive layouts, and existing shared-data workflows.

## 2026-11-03: Company logo

- Replaced the sidebar brand mark and header Z placeholder with the supplied company logo.
- Added the same logo to the login page and browser/application icon.
- Preserved the original transparent PNG without redrawing or changing its colors.
- Refreshed icon and script asset versions; recognition rules and business records are unchanged.

## 2026-11-03: Repository documentation in English

- Converted the README, deployment guide, database migration guide, historical migration specification, and update log to English.
- Documentation-only change: website interface languages, user-entered content, recognition rules, and business data remain unchanged.
- Chinese source examples are retained only where necessary to document exact parser inputs or stored values.

## 2026-11-03: Salary recognition fix (parser version 5)

### Root causes

- The position-pay label was not registered as a salary field, causing the entire line to be skipped.
- Currency matching did not support the complete `HK$` prefix: it could split it into `$` salary and an unwanted `HK` note.

### Changes

- Added six simplified/traditional position-pay labels: `职位薪酬`, `職位薪酬`, `职位薪资`, `職位薪資`, `岗位薪酬`, and `崗位薪酬`.
- Preserved complete `HK$` amounts, thousands separators, monthly units, and trailing `+`.
- Example: `[职位薪酬]HK$26000+` fills salary with `HK$26000+`.
- Recognized HK-dollar salaries following meal/accommodation descriptions.
- Extended non-salary currency cleanup to `HK$`; upstream agency, permit, insurance, and package-price quotations remain excluded.
- Updated the parser asset version so browsers request the new rules.

### Verification

JavaScript syntax checks, existing parser regressions, new label/currency/fee-exclusion cases, and browser acceptance checks passed. Browser checks cover single/batch entry, shared accounts, editing conflicts, source preservation, and interface language switching, with no browser errors.

### Applying the update

Refresh the website, run Auto-organize on the source order, review the salary, and save. Existing records are not automatically rewritten; re-recognition and explicit save are required.

Website: https://dongqimo.github.io/zy-labour-system/
