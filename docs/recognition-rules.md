# Source-Order Recognition Contract

This is the durable implementation contract. It describes the current shared system and supersedes historical recognition behavior in `migration-spec.md`. It is maintained together with the synthetic error catalog and executable regressions, not stored only in conversation history.

## Pipeline and ownership

The shared deterministic rule engine is `dist/order-parser.js`. Single entry, batch entry, re-recognition previews, source review, and publication validation call this engine. It is a deterministic, offline-capable JavaScript rule engine, not an externally trained model or an autonomous learning service. Improvements are deliberate code/rule changes tested against the catalog. Optional Gemini or DeepSeek assistance is separately configured and documented below; neither provider is enabled by a source-code deployment alone.

1. In batch entry, staff-provided standalone `---` (or the existing explicit separator aliases) defines each document; never infer additional documents inside a supplied segment. Single-entry submission explicitly owns one document boundary, including repeated supplier references and footer role summaries; it must not be rejected by heuristic splitting. Existing-order re-recognition also treats the selected record as one document. Low-level heuristic split helpers remain for legacy diagnostics only. Boundary metadata is private and retained on save/re-recognition.
2. Build logical source units and UTF-16 spans, recovering inline and wrapped labels without deleting unknown text.
3. Collect literal position/employer candidates across all source units before clause routing, then classify clauses using explicit labels, paragraph scope, and semantic cues. A line can supply several fields. Generic role/currency separation replaces role-specific shortcuts.
4. Assemble candidates for every field after classification. Check independent main salaries, titles, and gender for conflicts before choosing values.
5. Sanitize company fields, classify financial information, and format company monthly salary.
6. Produce provenance, exclusions, review items, and conflicts from the actual classified spans, not substring guesses about final output.
7. Validate save/publication. Required fields, uniqueness, fee confidentiality, and manual review are separate checks.

## Four fragment dispositions

Every meaningful source fragment has an ID, exact source range, line reference, original excerpt, fields, disposition, and reason:

| Disposition | Meaning |
|---|---|
| `classified` | Assigned to explicit company field(s), including structural headings |
| `excluded` | Deliberately excluded with a reason, such as supplier quote or promotional heading |
| `review` | Unrecognized, unsupported, or mixed content needing staff review |
| `conflict` | Competing candidates could not be safely reconciled |

Unknown labels and unhandled text must remain in the review list. Do not silently discard them. Source spans refer to the archived source after the existing supplier-ID sanitization; UTF-16 offsets are JavaScript string indices. Whitespace and clause separator punctuation need no independent business disposition. Tests check meaningful-character coverage, exact excerpts, unique IDs, and allowed dispositions.

The ledger records how text was handled; it is not a guarantee of semantic correctness. Staff must still review fields and uncertain conditions.

## Field precedence and boundaries

- Prefer explicit labels and their paragraph scope over unlabeled guesses. A role heading may contain an attached salary, so extracting the title must not consume or erase its wage.
- Position excludes source IDs, wages, trailing salary plus signs, headcount, age/gender/language qualifiers, approval-only job names, interview instructions, and promotional headings.
- Extract all supplier letters before stripping the full source ID. Company codes use `ZY-YY-MMDD-NN PREFIX`; suffixes do not reset base-code sequencing. Supplier letters are suggested only at initial recognition. Saved or manually edited company codes are authoritative: sanitization, display, save, and re-recognition must not reattach or replace their suffix from provenance metadata.
- Extract explicit currency evidence even when an adjacent compact role is unfamiliar. An unfamiliar role is extracted literally when a label, hiring relationship, compact wage heading, or unique corroborated standalone heading supports it. Dictionary membership is not required. Unsupported or ambiguous headings stay in review; they must not erase a valid wage or be guessed. Location shorthand before a role is separate from its actual name.
- Extract age, education, gender, languages, and experience from prose summaries even when age or education appears first. Do not interpret gender embedded in a job name, customer description, or duty as a hiring restriction.
- Explicit gender labels take precedence. Conflicting explicit values remain unresolved rather than defaulting to unrestricted. Final order gender uses only male, female, or unrestricted Chinese business values.
- Distinguish skills/qualifications from operational duties. Unlabelled office-document activities remain duties. Known explicit duties/requirements paragraphs preserve author intent.
- Position and employer candidates carry literal source excerpts, exact UTF-16 start/end offsets, evidence rank, and reason. Known field labels share aliases, including work-position, hiring requirements, accommodation, mandatory skills, region and contract-period spellings. Closing-only field brackets are recognised at the start of a unit. An experience sentence incorrectly labelled as a position supplies requirements instead of a second position. Explicit labels outrank recruiting relations and inferred headings; different candidates at the strongest rank leave the field blank and trigger review. Weaker mentions do not overwrite an explicit identity.
- A hiring sentence can supply employer, position, wage, gender, and age independently. Removing field labels, decorative symbols, and location/wage suffixes does not authorize paraphrasing or supplying an unstated job, employer, or duty.
- The role dictionary only corroborates weak standalone headings. An unlisted short standalone heading may be accepted when it is the unique viable heading in a wage document; certificates, promotional text, duties, accommodation conditions, locations, and unknown labelled conditions are not position headings.
- Employer headings include groups and common establishments. Hiring relations are split into literal employer/position excerpts. Distinct employers at the same evidence strength are not concatenated. A wage alone is never evidence of an employer. Do not invent an employer or duties from a position.
- Clear standalone demographic summaries are extracted separately from preceding paragraph scope. Identifying a position/employer must not consume adjacent age, gender, or salary evidence.
- Multi-order boundaries recognise unfamiliar compact wage headings and include the current line as wage evidence. They do not require a salary on a subsequent line.
- There is no separate company Shift field. Merge source/legacy shift descriptions into Working Hours, retaining the original description and avoiding duplicate wording.
- Recognise source control characters as whitespace on the recognition copy, never by rewriting archived raw text or existing review fingerprints. Remove flags/chat decorations from company fields, retain exact archived source spans, require age units outside explicit age labels, and treat clock ranges only as schedules. Preserve spaced age qualifiers and combined schedule/age evidence.
- Preserve language proficiency, interview preparation, bonus eligibility, accommodation requirements, and physical quantities. An unclear rest shorthand is retained and flagged, not converted to an invented monthly total.

## Financial contract

| Kind | Destination |
|---|---|
| Main wage | Salary |
| Explicit allowances, bonuses, base-pay components, commissions | Salary, retaining amounts and eligibility |
| Employee accommodation, meal, and payroll deductions | Notes, retaining amounts, percentages, and conditions |
| Supplier package/total/cost quotations, agency/permit/insurance quotations | Excluded from company fields |
| Unlabelled standalone footer amounts or arithmetic | Excluded; never used as salary or the ZY price |
| Ambiguous mixtures or unsupported money context | Review; retain safe facts only |
| ZY package price | Separate company input/suggestion |

Company monthly salary uses `HKD15920` or `HKD15920+`; only an existing plus is retained. Original source amounts remain in the archive. Do not invent exchange-rate or hourly-to-monthly conversions. Explicit foreign currencies and non-monthly units retain their meanings.

Financial filtering must use context. Producing a quotation document, entering insurance information, and maintaining expense reports are business duties, not supplier fees. However, a document-like label followed by an actual quotation amount must not bypass fee filtering. Preserve temperatures, watts, weights, ages, working hours, and experience years.

## Review and existing records

The review panel exposes sources, excluded excerpts with reasons, conflicts, and unclassified content. New-engine records with unresolved source fragments may be saved for later review, but publication/copy requires explicit acknowledgement after necessary information has been entered. Required title, gender, salary, and fee checks still apply; acknowledgement cannot bypass them. Changing source text invalidates prior acknowledgement; changing the parser version does not. Historical version-prefixed tokens remain valid for the same source. The acknowledgement fingerprint is a workflow aid, not an authentication or security mechanism.

Saving an existing company order is explicit human confirmation and stores durable source/timestamp/reviewer metadata without a second checkbox. Meaningful persisted manual-field edits and valid historical acknowledgements are recognized as prior review evidence; ready price status alone is not evidence. Human-confirmed company values take precedence over subsequent parser disagreement, and the read-only audit must not re-flag those orders. Field completeness and source-price confidentiality checks still apply.

Manual field changes refresh warnings without replacing the form, allowing corrected missing-field messages to disappear. Raw source is immutable during company-order editing. Re-recognizing an old order produces a preview and preserves the independently entered company price; saving is explicit. No bulk rewrite is performed. Old records are not forced through structural re-recognition merely by viewing them.

Metadata uses scalar JSON-compatible strings (`parserVersion`, `parsedSnapshot`, `manualFields`, `recognitionAudit`, `reviewConfirmation`, and supplier prefix). Internal audit text may include excluded supplier prices because it documents the private source; publication must only use the explicit company-field allowlist.

## Error memory and release procedure

The error catalog is `tests/fixtures/recognition-errors.json`. Its stable case IDs, root causes, synthetic sources, expected fields, forbidden output, and review/exclusion/conflict expectations are executable in `tests/recognition-mechanism.mjs`.

For every new defect:

1. Reproduce the whole source format, then replace identifying details and amounts with synthetic data.
2. Add a failing catalog case explaining the cause, not only a screenshot-specific expectation.
3. Add nearby counterexamples and variants in ordering, labels, roles, currencies, or punctuation.
4. Change the shared rule, replacing obsolete branches rather than stacking unrelated overrides.
5. Run syntax, all parser suites, and relevant browser/API checks. Verify source preservation and no overwrite before confirmation.
6. Update this contract when behavior changes and record the release in the English update log.

GitHub runs recognition checks on relevant pushes and pull requests. The Pages workflow runs the same syntax and complete parser suites before configuration generation and deployment, so a parser regression prevents that deployment. Browser acceptance is run locally for form or publication changes; CI does not currently run Chromium.

## Retained and removed code

Retained: shared-field schema, authenticated adapters, permissions, conflict-protected persistence, source archives, manual data, backup/restore, HKD formatting, salary/deduction distinction, supplier-prefix handling, and narrow legacy repairs.

Removed/replaced: inline first-match title/employer routing and unranked employer concatenation (replaced by document identity evidence collection), the food-processing-specific compact-header branch, the old line fall-through classifier, pre-classification deletion of unknown/financial lines, reverse-substring provenance guesses, and overridden inline single/batch/save/copy handlers. Do not restore them as a fallback: maintain one tested path.

## Read-only seven-field self-audit

`dist/order-audit.js` inspects authenticated sources by company code. Human-reviewed business orders are never re-flagged, and their edited fields are not exported as machine results. For other records the read-only view checks the latest source parse and provenance, distinguishes absent evidence from extracted-field conflicts, and does not count differences from current human values as parser errors. Missing facts stay empty. Opening a proposal uses explicit preview/save and never writes automatically.

## Retired first-machine snapshot archive

At the owner's explicit request, extra original-input/first-machine snapshots are no longer captured or exported. The legacy `firstRecognition` field is removed on workspace entry via the existing revision-checked order write, and stripped from current-client writes, imports and new portable exports. This cleanup is idempotent and does not modify `raw`, company fields, human-review metadata, codes, prices or creation timestamps. Failed/conflicting cleanup is not reported as complete and can retry on next entry.

The optional hosted migration `202611080001_retire_first_recognition.sql` purges existing snapshot fields and adds a narrowly scoped trigger to prevent old clients from restoring them. It must be run in the hosted database by its owner; publishing frontend assets does not execute SQL. Previously downloaded backups and provider-retained database backups are outside this active-record cleanup.

Business sources, parsed comparison baselines and evidence needed for current review/manual ownership remain. The read-only self-audit is retained without the historical snapshot download. No autonomous training or rule deployment is introduced.

## Company fee note

The persisted `price` field remains for compatibility and retains its existing automatic suggestion calculation and manual ownership. UI labels now refer to a fee-note amount, formatted as one decimal plus `w`. Company publication ends with `备注：劳务，服务费管理费：x.xw全包` and a separate `以上内容仅供参考，具体信息以面试为准` line. Employee deductions remain in other notes, and supplier fees never supply this independently owned amount.

## Optional Gemini assistance

`dist/ai-recognition.js` calls only the authenticated Supabase transport, never Google directly. The separately deployed `recognize-order` Edge Function requires explicitly enabled model/key secrets, validates active team membership, reserves atomic database quota, redacts recognised contact/identity details and submits only the current job source. The model returns allowlisted literal facts with exact source excerpts; company code and ZY price are never model-controlled.

For fresh machine drafts, validated AI facts replace populated rule guesses as well as filling absent fields; disagreements remain visible for review. Persisted records, manual-field metadata and human-confirmed records are not merged in place. Explicit re-recognition creates a fresh preview without saving it automatically. Source provenance, original rule unknowns, fee filtering, human review and fixed three-value gender remain in force. Late responses do not replace concurrent manual edits. No worker data, background audits, bulk database exports or automatic business writes go to Google. Disabled/missing/unavailable AI retains rules. Current recognition metadata records provider/model; retired first-machine snapshots are not created.

SQL, transport and model boundaries have mocked tests; live account/model setup and real recognition quality still need verification. See [Gemini setup](gemini-setup.md). No automatic learning or autonomous rule deployment occurs.

## Optional DeepSeek provider

The same authenticated assistance contract also supports DeepSeek, selected explicitly by server secrets. It uses fixed allowlisted literal facts, existing quota reservations and current recognition metadata. Truncated completion output is rejected; reasoning shares the 8192-token cap. Existing populated fields and manual ownership remain authoritative. See [DeepSeek setup](deepseek-setup.md) for deployment, activation and limitations. The local test prompt differs from this extractive production prompt; live acceptance remains required.

## Recognition progress

Single-entry Auto Organise shows a smooth simulated waiting percentage, explicitly labelled as animation rather than actual model progress. A bounded timer eases toward 95 percent while waiting; only an applied result reaches 100. Success, failure, discarded late results and detached views stop the timer. Repeated clicks stay disabled during requests. Reduced-motion preferences disable visual transitions. Both rule and AI duration checks accept Cantonese 个钟/個鐘 units without treating currency suffixes as hours.
