# Optional Gemini recognition assistance

The website integration is ready to call a separately deployed Supabase Edge Function. Publishing GitHub Pages does **not** deploy that function, apply SQL, create an API key, enable billing, or turn on Gemini. The existing rule engine remains the fallback. This integration is not training or unattended self-learning.

## 1. Create the key privately

Use [Google AI Studio](https://aistudio.google.com/apikey) to create a Gemini Developer API key in your own project. Review the current model availability, supported regions, free-tier limits, and Google data-use terms for your account. Free service is not guaranteed or unlimited. In particular, evaluate the free-tier handling of submitted business text before enabling it. Do not paste the key into chat, GitHub, a browser config file, or a deployment log.

Choose an available `gemini-*` model ID that supports `generateContent` structured JSON output. Copy its actual ID, without a `models/` prefix. No model name is hardcoded: availability changes, and the account owner must choose one from their current model list.

## 2. Apply the private quota migration

In the existing Supabase project's SQL Editor, run:

[`supabase/migrations/202611050001_gemini_quota.sql`](../supabase/migrations/202611050001_gemini_quota.sql)

This requires the original shared-schema migration already installed. The two new tables contain counters only, never source orders or API keys. They have RLS and no direct client table privileges. The authenticated `zy_ai_reserve()` RPC checks active team membership and maintenance mode, then atomically reserves a call before contacting Google.

Initial caps are 20 calls per account per business day, 100 for the entire team, with a two-second per-account cooldown. Business days use Asia/Hong_Kong. Failed Google requests also consume a reserved call; no automatic retry occurs. These caps supplement Google's own quotas, which may be lower, and are not a dollar budget. Change limits only deliberately in the SQL function.

## 3. Set Supabase Edge Function secrets

Under Edge Functions → Secrets, add:

| Name | Value |
|---|---|
| `GEMINI_API_KEY` | Your private Google API key |
| `GEMINI_MODEL` | The available model ID chosen in step 1 |
| `GEMINI_ENABLED` | `false` during setup; `true` only when ready to enable |
| `ZY_ALLOWED_ORIGINS` | Include `https://dongqimo.github.io` |

The origin contains no repository path and no trailing slash. Preserve any previously authorised origins in the comma-separated list: the existing `team-admin` function uses this setting too. Supabase provides `SUPABASE_URL` and `SUPABASE_ANON_KEY`; do not copy service-role credentials into the website. This function does not need a service-role key.

## 4. Deploy `recognize-order`

Deploy these two files together:

- [`index.ts`](../supabase/functions/recognize-order/index.ts)
- [`validation.ts`](../supabase/functions/recognize-order/validation.ts)

The dashboard code editor must include both files with these names. Alternatively, from a checked-out repository using an authenticated Supabase CLI:

```sh
supabase functions deploy recognize-order --project-ref fjpvgxfkerbnqcctclqo --no-verify-jwt
```

`supabase/config.toml` also sets `verify_jwt=false` for this function. That gateway option does **not** make business calls public: the function requires the caller's real Bearer token and validates it through `zy_session`, with another live membership check in the reservation RPC. This supports current Supabase Auth signing keys and publishable keys. Unauthorised origins, outsiders, disabled members, paused writes and exhausted quotas do not reach Google.

## 5. Enable and test with synthetic text

After steps 1–4, set `GEMINI_ENABLED=true`, reload the website, and sign in with an active team account. Click Auto-organize with a synthetic job order before using real business text. Single entry, each explicitly separated batch segment, and an explicitly requested re-recognition preview can request assistance. Background audits, page viewing, worker forms, and worker PDFs never send data to Gemini.

The browser checks the authenticated status endpoint. If the function is missing or disabled it uses rules; after changing configuration, reload to clear the cached status. If Google is unavailable, times out, returns incomplete/unsupported facts, or reaches a quota, rules are retained with a fallback notice. There is no automatic paid retry, model switch, or billing upgrade.

The wire API is Gemini Developer API `v1beta/models/{model}:generateContent`, using server-only `x-goog-api-key`, structured JSON, no tools, and no model-directed network requests. Live availability must be verified with your account: repository tests mock Google, not a real paid/free call.

## Extraction and privacy contract

Only the current job source is sent, never the business database, worker records, Auth credentials, photos, or PDFs. The server masks recognised email addresses, labelled telephone numbers, mainland identity numbers and bracketed Hong Kong identity numbers before sending. Masking is not a guarantee that every personal detail is recognised; do not paste applicant personal data into job-source text.

Each model fact must provide a fixed allowlisted field, an exact value, and an exact source excerpt containing that value. Unsupported/invented values are rejected. Company code and ZY price are not model fields. Supplier fees/footer amounts are filtered, and the browser applies the existing company privacy/salary checks again. The model only fills missing fields; conflicting existing identity/pay/age values are retained and flagged for human review. Literal evidence does not prove semantic correctness: human review is still required.

There is no automatic business save. A late response cannot overwrite edits made while the request was running or fill a form after navigation/logout. The first automatically displayed snapshot records the provider/model along with rule version and remains independent from later manual business edits.

To disable external requests, set `GEMINI_ENABLED=false`; the backend stops calling Google immediately. Reload clients so the status cache also reflects the change. Existing orders and first snapshots remain unchanged.
