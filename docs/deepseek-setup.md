# DeepSeek recognition setup

DeepSeek is an optional provider for the existing `recognize-order` Supabase Edge Function. It is not called directly from GitHub Pages. No API key belongs in source code, browser storage or public configuration.

## Deploy and configure

1. Update both function files from `supabase/functions/recognize-order/`: `index.ts` and `validation.ts`. Keep the function name `recognize-order` and disable gateway legacy JWT verification as specified in `supabase/config.toml`; the handler authenticates active membership through `zy_session` itself.
2. Keep the existing quota migration, Supabase defaults and `ZY_ALLOWED_ORIGINS` (for example `https://dongqimo.github.io`). No new business database migration is needed. The existing quota migration must already be installed.
3. Add these Supabase Edge Function secrets, with exact names and no backticks:

| Name | Value |
| --- | --- |
| `AI_PROVIDER` | `deepseek` |
| `DEEPSEEK_API_KEY` | Owner's private API key |
| `DEEPSEEK_MODEL` | `deepseek-flash`, if listed as available by the owner's account |
| `DEEPSEEK_ENABLED` | `true` |

Deploy the function before enabling. Gemini secrets may remain, but only the selected provider is called. An explicitly selected but incomplete/disabled DeepSeek configuration does not fall through to Gemini. Set `DEEPSEEK_ENABLED=false` to stop calls. Refresh the website after changing activation because availability is cached for the login session.

## Operation and limitations

Explicit single, batch and re-recognition actions use the shared assistance path. Existing populated fields remain authoritative; different identity/pay/age candidates require review. Missing fields can be filled from literal evidence. Pending responses cannot replace concurrent edits. Saved human-reviewed records are not bulk rewritten, and supplier suffixes are never restored by the model.

Only the current source, after recognised contact/identity masking, is sent to DeepSeek. This masking is not comprehensive anonymisation. The model returns allowlisted literal facts; the application formats salary and retains foreign currencies. Code and company package price are not model-controlled. First-machine snapshots retain actual provider/model metadata when the business order is saved.

The request uses JSON mode, an 8192-token completion ceiling and a 90-second upstream timeout, with no automatic retry. Reasoning can consume that ceiling; anything other than `finish_reason=stop` is rejected. Calls may incur charges even when truncated or rejected. Existing atomic caps remain 20 calls/member/day and 100/team/day, with cooldown; these are request caps, not currency budgets. Batch calls are sequential and can be slow.

Mock tests cover authentication, origin checks, reservation, server-only keys, literal provenance, redaction, failure and truncation. They do not prove live hosted deployment or model accuracy. The owner's local tests used a different output prompt/schema; the deployed extractive contract needs its own small end-to-end acceptance test before relying on it.

No daily self-training or autonomous rule publication is introduced.
