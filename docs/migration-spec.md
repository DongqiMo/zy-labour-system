# ZY Labour System: Original Technical Migration Specification

> Historical reconstruction reference supplied for OpenAI Codex. This document records verifiable pages, fields, rules, and behavior of the original application; unconfirmed or unimplemented behavior is identified separately rather than treated as a new requirement.
>
> Historical baseline: public application v74, 2026-11-02, at <https://zy-order-manager.modestmango18.chatgpt.site>.
>
> **Scope:** References to “current” in the original specification mean that historical application. The rebuilt repository now has shared storage, authentication, revised recognition rules, and other changes. See [README](../README.md) for the present implementation. Historical PDF/template capabilities below are not claims that those assets or features exist in this rebuild.

## 1. System overview

- Brand: ZY Labour System, a Hong Kong/Macao labour management application.
- Original implementation: a static single-page application. HTML, CSS, and most JavaScript were in `dist/index.html`, accompanied by `app.webmanifest`, `sw.js`, `icon.svg`, and `worker-registration-template.png`.
- Original deployment: publicly accessible frontend, with orders and workers stored separately in each visitor's browser. Visitors did not share records.
- No confirmed server API, remote database, login, permissions, or cross-device synchronization. The database page was a local order list; worker records used IndexedDB.
- The PWA manifest used standalone display. A Service Worker cached the shell, HTML, manifest, icon, and registration template. Offline shell caching was not a shared data service. PDF/OCR required third-party libraries to be loaded online initially.

## 2. Pages and features

### 2.1 Today's order overview (`view-dashboard`)

- Fixed top bar: breadcrumb, current date, circular Z mark. Desktop navigation used a navy sidebar with Today's overview, Order database, Worker registration, and Registered workers.
- Sticky heading area: title, description, New order button, three statistics cards, position search, and status filter.
- Statistics: today's total, today's package-price confirmations pending, and today's completed orders. Selecting a card navigated to the list with the corresponding filter.
- Only records created on the browser's local calendar date appeared, retaining record order.
- Search matched job title only. Filters were All, Awaiting ZY package price, and Publication draft generated.
- Cards showed company code when present, position, entry date, employer, monthly salary summary, gender, age, package price, and status. Source order and Company order were collapsible sections.
- Cards supported deletion; draft orders offered price entry; company text was editable; completed orders could be copied for publication.
- Deletion required confirmation and had no application-level undo.
- Between 641 and 960 px, CSS hid the card price area; at 640 px or below it appeared again.

### 2.2 New order workspace (`view-new`)

Both single-entry and batch-entry modes existed.

**Single entry**

1. Paste the original recruitment message.
2. Auto-organize converted text to simplified Chinese and extracted fields through labels, keywords, and text-position heuristics.
3. Review/edit company code, position, employer, salary, gender, age, language, hours, shift, interview, monthly rest, duties, requirements, notes/fees, and ZY package price.
4. Suggested package price was monthly salary + 20,000, rounded down to the nearest 1,000 and displayed in `w` units. Users could override it. Salary retained its original currency/number format.
5. Save required source text, title, and a unique company code. An empty/zero package price meant pending; a positive price meant completed.

The three-step indicator represented Source entry → Information review → Price confirmation/publication. It did not require three separate screens: the single form already contained the price field and determined status on save.

**Historical batch entry**

- Paste multiple sources separated by standalone `---`, repeated hyphens/underscores/equals/asterisks, next-order/next-item markers, or numbered order/item headings. Without explicit separators, the original code also attempted splits at `AT-...` or `ZY-YY-MMDD-NN` lines.
- Recognize and preview showed title, employer, salary, gender, and age for each item. Each source could be expanded/edited or removed.
- Each item required a title. Historical batch saves left package prices empty and statuses pending; prices could be filled afterward. The rebuilt complete batch form supersedes this historical limitation.

### 2.3 Order database (`view-orders`)

- Listed all local orders grouped by entry date, newest dates first, preserving order within groups.
- Sticky heading/search/filter area with a New order action. Search matched titles only; filters matched the overview.
- Cards supported source/company viewing, company editing, deletion, pending-price entry, and copying completed publication text.
- Company editing never changed `raw`. Empty/zero prices set pending; nonzero prices set publication-ready. Code was required and unique.

### 2.4 Worker registration (`view-workers`)

- Sticky header actions: PDF recognition, Download backup, and New registration. The original notice explained that records/photos were browser-local and PDF processing required the person's consent.
- Sections: basic information, previous Hong Kong labour experience, education/training, employment history, languages/skills, job preferences, and contacts.
- Photos supported upload, drag-and-drop, and removal. Education history allowed at most two entries; work history at most four. Entries were removable.
- Only name was required, including before preview. Saved records could be edited.
- Historical PDF recognition accepted PDF files up to 25 MB, filled the current form, and asked before overwriting recognized fields. Review and save remained necessary.
- Preview offered Return to editing and Print / Save as PDF. PDF saving used the browser print dialog rather than server generation.
- Download backup exported JSON; no corresponding restore/import UI was found in the historical application.

### 2.5 Registered workers (`view-workerRecords`)

Rows showed a photo/placeholder, name, gender, age, first job preference, and last update time. Records were ordered by most recently updated and supported editing, preview, and confirmed irreversible deletion. Backup and New registration actions were also present.

### 2.6 Dialogs and unreachable interfaces

- The price dialog existed and was reachable through pending cards. A positive price completed the order; empty/zero retained pending status.
- A source/new-order preview dialog and copy handler existed in code, but no visible card action opened it. Treat this as an unconnected UI rather than an available feature.
- Worker preview was reachable from both registration and registered-worker pages.

## 3. Source text, company orders, and fields

### 3.1 Source text

The complete source was stored in `raw` for review and collapsible display. Pasted text was converted to simplified Chinese, so `raw` did not guarantee preservation of original traditional characters. Company editing did not change it.

Historical recognition ignored `#` lines, `DJ: number` lines, and standalone numeric/amount lines; these remained in archived text. Unlabelled bottom numbers, usually supplier prices, were not intended to become salary or package price.

### 3.2 Company-order schema

| Field | Storage key | Historical meaning |
|---|---|---|
| Company code | `code` | Editable `ZY-YY-MMDD-NN` code |
| Position | `title` | Reviewed title; missing recognition blocked saving |
| Employer | `employer` | Filled when explicit in the source |
| Monthly salary | `salary` | Original number/currency format, also used in publication |
| Recruitment gender | `gender` | Normalized source wording for male/female/unrestricted |
| Age requirement | `age` | Range, upper limit, or other age text |
| Language requirement | `language` | One or more recognized requirements |
| Working hours | `hours` | Schedule, separate from job requirements |
| Shift | `shift` | For example, morning or overnight |
| Monthly rest | `rest` | Rest arrangement |
| Duties | `workContent` | Responsibilities/main work |
| Requirements | `requirements` | Experience, qualifications, personal requirements |
| Notes and fees | `notes` | Historical accommodation/agency/insurance/management text; current privacy rules supersede this |
| Interview method/time | `interview` | Method, timing, or location |
| ZY package price | `price` | Separate price; empty/zero pending, positive complete |
| Source text | `raw` | Full simplified source |
| Status | `status` | `draft` or `ready` |
| Record ID | `id` | Timestamp string, batch timestamp plus index, or original sample ID |
| Created timestamp | `createdAt` | ISO datetime string |

Historical internal helpers included `rawGenderAge` and `rawSchedule`. Other legacy object keys could survive saves; company editing also wrote `location: ''`. These were not editable form fields.

### 3.3 Historical recognition scope and precedence

- Convert traditional to simplified Chinese, then exclude recognition-only noise.
- Recognize bracketed labels, colon labels, numbered fields, irregular headings, and prose.
- Position extraction did not use fixed row numbers. Candidates approximately prioritized explicit position/role/trade labels, role headings, recruitment phrases, text after company codes, headings before salary, and finally short non-label headings. Salary lines had exclusion rules.
- Employer extraction preferred employer/company/unit labels, otherwise short lines containing establishment terms such as salon, restaurant, factory, company, or stall, excluding recruitment noise.
- Gender/age came from labels, combined fields, or text keywords. The historical heuristic normalized both genders or explicit unrestricted wording to unrestricted; the rebuilt parser adds conflict safeguards.
- Languages included Cantonese, Mandarin, English, Japanese, Korean, Hakka, and Teochew.
- Hours preferred working-time labels, otherwise hour quantities. Shift keywords included overnight/night/morning/rotating. Rest used labels or monthly/rest-day phrases.
- Duties and requirements used separate headings and following paragraphs. Numbered schedule, salary, address, employer, and title fields were not intended to merge into requirements.
- Historical notes included accommodation, agency, insurance, service, management, permit, and leave information. Interviews used labels or video/online/in-person/telephone keywords. Current supplier-price confidentiality rules supersede historical fee inclusion.
- Extraction was heuristic, not guaranteed OCR or universally accurate recognition. Staff review was required.

### 3.4 Publication text

Historical copy order:

1. Company code and position, separated by a vertical bar.
2. Employer, if present.
3. Nonempty position, gender, age, language, hours, shift, salary, rest, duties, requirements, notes, and interview fields.
4. ZY package price, or pending confirmation if absent.

The historical publisher split notes on newlines, semicolons, and full stops, dropping clauses containing the package-price term to avoid duplication. Salary formatting remained unchanged. Current upstream-price removal is stricter than this historical behavior.

## 4. Calculation and business rules

### 4.1 Company codes

Format: `ZY-{two-digit year}-{month}{day}-{sequence}`, for example `ZY-26-1101-07`. The original application took the highest same-day sequence from local records and incremented it, allowed manual changes, and checked uniqueness on save. Batch codes were generated before price confirmation. The current system also appends supplier letters and compares base-code sequences.

### 4.2 Suggested package price

- Take the first numeric salary value after removing thousands separators. Leave the suggestion blank without a valid positive amount.
- Formula: `floor((monthly salary + 20,000) / 1,000) × 1,000`.
- Display in ten-thousand units with one decimal and `w`: 18,799 salary → 38,000 → `3.8w`.
- Salary changes recomputed the suggestion until manual price editing. After manual editing, price stayed fixed until Auto-organize was run again.
- Only package prices used `w`; salaries retained source formatting.
- Existing plain numeric prices were divided by 10,000 without rounding: 23,124 → `2.3124w`. Existing `w`/ten-thousand-suffix values stayed as written. Salary was unaffected.

### 4.3 Status

- `draft`: awaiting ZY package price; empty/zero price on creation/edit, including historical batch saves.
- `ready`: publication draft generated after a nonzero price was saved.
- Draft badge: light orange `#fff4df` background and `#9b5c13` text. Ready/code badges: light blue `#e4effa` and `#2f65a0`.
- Draft cards offered confirmation/price entry; ready cards displayed price and supported company-text copying.
- Zero detection included numeric/decimal zero, zero with `w` or a ten-thousand suffix, and currency-prefixed zero.
- Historical display caveat: string `"0"` could display as `0w` while status correctly remained draft. This was not a completed zero-price order.
- Loading used saved `status`; creation, price entry, and edits recomputed it. Inconsistent legacy statuses were not automatically repaired on first render.

### 4.4 Dates and age

Today used the browser's local calendar date against `createdAt`. The full database grouped by local date, newest first; invalid dates appeared under Date not recorded. Worker age preferred entered `age`, otherwise completed years calculated from `birthDate` and the current date.

## 5. Search and record operations

Overview and database had separate title-only search inputs, with All/draft/ready filters. Single creation required source, title, and code; price could be blank. Historical batch creation required preview and titles. Editing covered company fields and price, preserving source text and enforcing title/code uniqueness. Pending-price entry changed status according to positive versus empty/zero price. Ready company text could be copied; the unconnected source-preview dialog did not provide a usable card action. Order and worker deletion required browser confirmation and had no in-app recovery.

## 6. Visual layout and interaction

### 6.1 Historical palette

- Pale gray-green background `#f5f7f4`, white cards, dark body text `#1d2927`, muted text `#78837f`. The rebuild explicitly uses a white page background.
- Navy sidebar `#172b46`, gold branding `#e3bd70`, primary blue `#2f65a0`, and the status colors above.
- Font stack: `-apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif`.
- Content width approximately 1,360 px; card radii approximately 8–12 px, light borders, subtle shadows.

### 6.2 Responsive behavior

Desktop used an approximately 238 px full-height sidebar and a 72 px top bar. Overview/database heading panels and registration headers were sticky; content lists scrolled. Mobile navigation became a fixed bottom bar.

At ≤960 px, the sidebar narrowed, new/batch forms became one column, and order cards rearranged. At ≤640 px, spacing tightened, the top bar became 57 px, navigation stayed at the bottom, controls shrank, and comparison areas became single-column.

Interactions included hover/focus states, blue input focus outlines, collapsible sections, badges, toasts, delete confirmations, modal previews, and clickable/draggable photo upload.

## 7. Worker fields and historical PDF behavior

### 7.1 Fields

| Group | Keys |
|---|---|
| Basic information | `name` (required), `gender`, `birthDate`, `age`, `height`, `weight`, `marital`, `hometown`, `health`, `education`, `permit`, `idNumber`, `idValidity`, `idAddress`, `currentAddress` |
| Hong Kong employment | `workedHongKong`, `hkEmployer`, `hkExitDate` |
| Languages and skills | `cantonese`, `mandarin`, `english`, `otherLanguages`, `certificates`, `hobbies` |
| Preferences and contacts | `desiredJob1`, `desiredJob2`, `desiredJob3`, `desiredSalary`, `phone`, `alternateContact` |
| Photo | `photo`, compressed JPEG data URL |
| Imported source PDF | `sourcePdfData`, PDF data URL; `sourcePdfDirty`, whether fields changed after import |
| Education history | `educationHistory[]`: `period`, `school`, `major`, `qualification`; maximum two |
| Work history | `workHistory[]`: `period`, `employer`, `position`, `duties`; maximum four |
| System fields | `id`, `createdAt`, `updatedAt` |

Photos were resized to at most 1,000 px on the longest edge and encoded at JPEG quality 0.82.

### 7.2 Historical PDF recognition and preview

- PDF.js extracted text using fixed A4-template coordinate regions. Pages with fewer than 18 extracted text items that resembled scans were rendered at 2.5× for Tesseract simplified/traditional Chinese and English OCR.
- Recognized fields included identity, physical information, education, addresses, Hong Kong experience, histories, languages, skills, job preferences, salary, and contacts. Permit/employment/language-proficiency checkboxes used template positions and image scoring.
- Photo cropping only targeted particular first-page template coordinates. Recognition was not universal: layout changes, image quality, and checkbox marks affected results. Unrecognized fields retained current values or remained empty; review was required.
- PDFs were limited to 25 MB and stored as browser-local data URLs. An imported unedited PDF was used directly for preview/printing; edited forms used template-background text overlays.
- New forms printed over `worker-registration-template.png`. Overlong duties, certificates, and hobbies moved to an additional page; other fields used fixed positions. Desired salary had text scaling.
- PDF.js 4.10.38 and Tesseract.js 5 loaded lazily from CDNs. Initial recognition required internet access. No server upload/OCR implementation was confirmed.

The original background, coordinates, and OCR source were not provided to this rebuild; see the README for present limitations.

## 8. Historical storage

| Data | Location | Key/structure | Consequence |
|---|---|---|---|
| Orders | localStorage | `zy-order-desk-v1`, JSON array | Browser/origin-local; clearing site data loses records; no visitor synchronization |
| Workers | IndexedDB v1 | `zy-worker-register-v1`, store `workers`, keyPath `id` | Photos/source PDFs stored as data URLs with records |
| Worker backup | Downloaded JSON | `zy-worker-registration-backup-YYYY-MM-DD.json`, `format`, `version:1`, `exportedAt`, `workers` | Export only; no historical restore UI |
| Static assets | Service Worker Cache | `zy-order-desk-v7` | Offline shell/template, not business-data synchronization |

On first load without the order key, the original application inserted two example orders. Each browser then maintained its own records. The shared rebuild starts empty and does not insert these samples.

## 9. Historical capabilities and limitations

### Implemented in the original application

Single/batch source entry, heuristic extraction, manual review, source retention, code generation/editing, price suggestions/status, position search/filtering, daily overview, date-grouped full lists, company editing/copying, deletion confirmations, worker forms/photos/histories, template preview, browser printing, JSON backup downloads, template-specific PDF extraction/OCR, and PWA shell caching.

### Historical boundaries or unconfirmed features

- No shared database/remote persistence. A public link shared the frontend, not browser records, photos, or edits.
- No login, roles, collaboration, cross-device synchronization, cloud backup, or server audit trail.
- No order export/restore; worker JSON download had no restore flow.
- No arbitrary-layout PDF recognition guarantee; the supplied fixed template was required, with manual review.
- Source-preview code existed without a visible card trigger.
- Search covered title only, without date/employer/salary filters or advanced search.
- No pagination/server queries; local arrays were rendered in the frontend.
- Static source could not establish whether real user records existed in other browsers. This document assumes no specific record contents.

## 10. Reconstruction invariants from the original specification

1. Preserve salary formatting; use `w` formatting/conversion only for package prices.
2. Recognize positions from labels, job keywords, and whole-document candidates rather than fixed rows.
3. Do not treat standalone footer amounts or `DJ: number` as salary/package price; retain source text for review.
4. Store schedules in `hours`; keep requirements and duties separate.
5. Empty/zero package price is pending; nonzero is complete. Historical loading trusted saved status.
6. Store source and company fields separately. Company editing must not overwrite `raw`.
7. Historical browser isolation was a boundary, not shared-storage capability. Sharing required a separate migration/synchronization design, now documented elsewhere in this repository.
8. Original PDF backgrounds, coordinates, text limits, browser printing, and source-PDF preview were layout constraints; missing assets must not be represented as implemented.

## 11. Originally unresolved questions

- Whether the rebuild would remain local-only or move to shared storage. The current shared architecture is documented in the README.
- Whether the registration PNG matched the originally supplied PDF pixel-for-pixel; source alone could not prove this.
- OCR coverage for unseen layouts, low-resolution scans, rotated pages, or multi-column variants; no universal guarantee existed.
- The intended price-suggestion base when salary contained multiple numbers: the original implementation used the first numeric match.
