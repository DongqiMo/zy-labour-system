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
