# Worker Registration Template and PDF Adapter

## Source and compatibility

The original blank `worker-registration-template.png`, print coordinates, and PDF helpers were supplied in the user's legacy export, referencing source commit `984e1d740f1b3e11d0f5ee212a2bf68ea77693a1`. The blank template is copied unchanged. This migration imports worker-specific functionality only; it does not restore the old site's local-only database, demo records, offline cache, logo, order parser, or authentication behavior.

Current files:

- `dist/worker-registration.js`: form controls, template renderer, original-PDF preview, and PDF extraction adapter.
- `dist/worker-registration.css`: responsive editing controls and original A4 coordinate typography.
- `dist/worker-registration-template.png`: blank legacy template.

Existing worker keys, IDs, version checks, team permissions, and portable backups remain compatible. Unknown legacy select values are retained rather than cleared. Edits still save through the current application API; importing a PDF never saves automatically.

## Form and output

The form uses the existing fields in the original section order: basic information, Hong Kong employment, education/training (up to two entries), employment history (up to four), languages/skills, and job preferences/contacts. Gender, permit, marital status, and language levels use selections; dates use date controls when compatible with existing data. Text values and unsaved input survive interface-language switching.

Preview and browser Print / Save as PDF use the original background and A4 coordinates, with photo placement, proficiency checkmarks, and overflow appendices for long duties, certificates, and hobbies. Long text is kept in the appendix rather than discarded. The original renderer's missing language-checkmark Y coordinate and its CJK fitting expression were corrected. The original PDF label fallback's absolute/relative substring offsets were also corrected to avoid merging adjacent fields.

An imported, unedited source PDF is previewed directly. Form, history, or photo changes mark it dirty so preview uses the updated template rather than an outdated source PDF. Original PDF data remains part of the private record and portable backup.

## PDF recognition boundaries

PDF.js reads selectable text; the legacy coordinate and label helpers classify fields. Tesseract can handle scanned pages when text extraction is sparse. Components and language data load from the configured public CDNs; personal PDF content is processed in the browser, not uploaded to those CDNs for recognition. Failure preserves the current form.

Files are limited to 20 MB and 1–20 pages. The 20 MB limit leaves room for base64 encoding and record metadata under the application's 32 MB request limit. The fixed template is the target; arbitrary PDF layouts and OCR accuracy are not guaranteed. Users must review all extracted fields before saving.

Allowed CSP additions are scoped to the component CDN, trained-language-data host, blob workers/frames, and WebAssembly. Supabase access permissions are unchanged.

## Validation

`python3 scripts/worker_smoke.py` uses synthetic records and a temporary authenticated database. It checks:

- background loading, finite checkbox coordinates, photos, original fields, and one-page A4 PDF output;
- long-text appendices, legacy enum preservation, editing, shared persistence, language switching, and mobile overflow;
- invalid-file rejection and adjacent-label boundaries;
- the actual coordinate/merge adapter using a deterministic PDF.js boundary, preservation before save, original-PDF preview, and dirty-state template switching.

The adapter test does not establish real CDN availability or OCR accuracy for production scans. No real filled worker PDF was supplied in this export. Actual source PDFs still require staff acceptance checks.
