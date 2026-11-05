# Source-Order Recognition Contract

This is the durable implementation contract. It describes the current shared system and supersedes historical recognition behavior in `migration-spec.md`. It is maintained together with the synthetic error catalog and executable regressions, not stored only in conversation history.

## Pipeline and ownership

The sole recognition engine is `dist/order-parser.js`. Single entry, batch entry, re-recognition previews, source review, and publication validation call this engine. It is a deterministic, offline-capable JavaScript rule engine, not an externally trained model or an autonomous learning service. Improvements are deliberate code/rule changes tested against the catalog. Do not send source orders to external AI services without a separately authorized integration.

1. In batch entry, staff-provided standalone `---` (or the existing explicit separator aliases) defines each document; never infer additional documents inside a supplied segment. Retain single-entry detection of multiple coherent role/pay blocks as a guard. Boundary metadata is private and retained on save/re-recognition.
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
- Position and employer candidates carry literal source excerpts, exact UTF-16 start/end offsets, evidence rank, and reason. Explicit labels outrank recruiting relations and inferred headings; different candidates at the strongest rank leave the field blank and trigger review. Weaker mentions do not overwrite an explicit identity.
- A hiring sentence can supply employer, position, wage, gender, and age independently. Removing field labels, decorative symbols, and location/wage suffixes does not authorize paraphrasing or supplying an unstated job, employer, or duty.
- The role dictionary only corroborates weak standalone headings. An unlisted short standalone heading may be accepted when it is the unique viable heading in a wage document; certificates, promotional text, duties, accommodation conditions, locations, and unknown labelled conditions are not position headings.
- Employer headings include groups and common establishments. Hiring relations are split into literal employer/position excerpts. Distinct employers at the same evidence strength are not concatenated. A wage alone is never evidence of an employer. Do not invent an employer or duties from a position.
- Clear standalone demographic summaries are extracted separately from preceding paragraph scope. Identifying a position/employer must not consume adjacent age, gender, or salary evidence.
- Multi-order boundaries recognise unfamiliar compact wage headings and include the current line as wage evidence. They do not require a salary on a subsequent line.
- There is no separate company Shift field. Merge source/legacy shift descriptions into Working Hours, retaining the original description and avoiding duplicate wording.
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

`dist/order-audit.js` inspects authenticated shared orders by company code. It generates proposed fields from each source, checks provenance for position/employer/salary/gender/age/hours/duties, and lists missing information, unsupported values, conflicts, and differences from manual company fields. Missing facts stay empty; a title does not authorize inventing duties or an employer. Reports and source excerpts are private, cleared on logout, and never automatically applied to records. Opening a proposal uses the existing explicit preview/save flow with a fresh revision. Audits run after login and may be refreshed/downloaded for manual review. The assistant cannot claim a live-data audit without access to the authenticated dataset or its private export.
