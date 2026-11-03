# Website Update Log

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
