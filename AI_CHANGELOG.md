# AI_CHANGELOG.md

Append-only log of AI-agent changes for this repository.

Rules:
- ALWAYS append new entries.
- NEVER overwrite, rewrite, delete, or summarize previous entries.
- Include timestamp, task, files changed, and summary.
- Include auth impact for any auth-related or auth-adjacent change.
- For auth-related changes, include risk assessment and rollback plan.

---

## Entry
Timestamp: 2026-03-22 19:10:34 -04:00  
Type: retrospective  
Task: Bootstrap baseline summary from current repository state  
Files changed: none  
Summary:
- Identified project as Next.js App Router application with Supabase authentication.
- Confirmed Google OAuth login path and callback route are present.
- Confirmed protected access patterns exist using server-side `supabase.auth.getUser()` checks and route redirects.
- Confirmed middleware-based auth gate exists.
- Confirmed main data view loads records from `public.images`.
Auth impact:
- No runtime code changed.
- This baseline documents existing auth protections to reduce risk of accidental auth regressions in future edits.
Risk assessment:
- Low. Documentation-only retrospective entry.
Rollback plan:
- Not applicable; no code or config mutation.

## Entry
Timestamp: 2026-03-22 19:10:34 -04:00  
Type: change  
Task: Create/update `AGENTS.md` and `AI_CHANGELOG.md` with strict auth invariants and logging requirements  
Files changed:
- `AGENTS.md`
- `AI_CHANGELOG.md`
Summary:
- Added project agent operating rules focused on minimal/safe changes.
- Added explicit, non-bypassable authentication invariants.
- Marked auth-sensitive files and `supabase.auth.*` callsites as high-risk.
- Added required preconditions before auth edits (read changelog, explain intent, preserve behavior by default).
- Added append-only changelog policy and mandated auth risk/rollback logging.
Auth impact:
- No auth runtime behavior changed.
- Guardrails were strengthened to prevent future accidental auth breakage.
Risk assessment:
- Low. Documentation/process change only.
Rollback plan:
- Revert only documentation edits to `AGENTS.md` and `AI_CHANGELOG.md` if policy wording needs adjustment; no production auth rollback required.

## Entry
Timestamp: 2026-03-22 21:23:12 -04:00  
Type: analysis-blocked  
Task: Implement authenticated Yes/No voting from `/` using `public.caption_votes` for `is_common_use = TRUE` images  
Files changed:
- `AI_CHANGELOG.md`
Schema inspected:
- `schema.sql` (repo root; `supabase/schema.sql` not present in repository)
How image -> caption mapping was resolved:
- Found FK path `public.captions.image_id -> public.images.id`.
- Mapping is one-to-many from image to captions.
- No unique constraint or deterministic schema rule in dump to select exactly one caption per image.
- Blocked: writing an image-level vote into `caption_votes.caption_id` requires product clarification for target caption selection rule.
Auth impact:
- No runtime auth code changed.
- Existing auth checks, redirects, middleware, callback flow, and Supabase client setup remain unchanged.
RLS impact:
- No RLS changes applied.
- No `CREATE POLICY` or `ENABLE ROW LEVEL SECURITY` statements found in repository schema dump for the affected tables.
Affected table(s):
- `public.images` (read intent)
- `public.captions` (mapping analysis)
- `public.caption_votes` (write target)
- `public.profiles` (user/profile mapping analysis)
Policies added/changed:
- None
Expected access by role (`anon`, `authenticated`, `service_role`):
- Not changed by this task.
- Runtime role behavior remains as currently configured in the database (not altered in repository files).
Risk assessment:
- High risk to data correctness if implemented without explicit image->caption target rule.
- Additional schema mismatch risk: repository `caption_votes` definition does not include `created_by_user_id` / `modified_by_user_id`, while task requirements require those fields.
Rollback plan:
- No runtime rollback required (no runtime code/policy changes were made).
- Revert this changelog entry only if logging correction is needed.
Verification performed:
- Inspected current app auth flow and confirmed no auth file modifications.
- Inspected schema for `caption_votes`, `captions`, foreign keys, unique constraints, and RLS/policy statements.
- Confirmed absence of deterministic one-caption-per-image schema rule in repository dump.
Confirmation that vote changes update existing rows instead of inserting duplicates:
- Not implemented due schema/mapping blockers; therefore not verified in code.

## Entry
Timestamp: 2026-03-22 21:49:23 -04:00  
Type: change  
Task: Implement re-evaluation flow for previously downvoted content (`vote_value = -1`) on `/`  
Files changed:
- `src/app/page.tsx`
- `AI_CHANGELOG.md`
Schema inspected:
- `schema.sql` (repo root; `supabase/schema.sql` not present)
- Tables inspected: `public.caption_votes`, `public.captions`, `public.images`, `public.profiles`
Exact join/relationship path used to render caption + image:
- `caption_votes.caption_id -> captions.id`
- `captions.image_id -> images.id`
- UI renders the exact caption row referenced by the selected vote row and the exact image row linked from that caption.
Update logic used:
- Server action (`/` page) requires authenticated user via `supabase.auth.getUser()`.
- Select exactly one existing vote row for current user where `vote_value = -1`.
- On submit, lookup existing vote by `(id, profile_id = auth user id)`.
- If vote is unchanged, skip DB write.
- If changed, `UPDATE` existing row only (no `INSERT`), setting:
  - `vote_value`
  - `modified_datetime_utc`
  - `modified_by_user_id` only when runtime column check confirms it exists.
Auth impact (confirm unchanged):
- Auth flow unchanged.
- No changes to middleware, auth callback, Supabase server/client setup, or redirect protection.
- No client-side trust of user IDs; user identity is resolved server-side only.
RLS impact:
- No RLS or policy changes applied.
- No service-role key usage introduced.
Affected table(s):
- `public.caption_votes` (read/update)
- `public.captions` (read by exact `caption_id`)
- `public.images` (read by exact `image_id` from caption)
Policies added/changed:
- None
Expected access by role (`anon`, `authenticated`, `service_role`):
- `anon`: unchanged, no new write path.
- `authenticated`: can execute server action under authenticated session context; updates constrained to owned vote row by `profile_id`.
- `service_role`: not used by this feature.
Risk assessment:
- Low to moderate. Main risk is live-schema drift for `modified_by_user_id`; mitigated by runtime existence check before including column in updates.
Rollback plan:
- Revert `src/app/page.tsx` to prior image-grid implementation.
- No schema/policy rollback needed (none changed).
Verification performed:
- Ran `npm test` (`npm run lint`), passed with 0 errors (1 existing warning on `<img>` usage).
- Verified code path updates existing vote row and never inserts new rows for re-vote.
Confirmation that existing vote rows are updated, not duplicated:
- Confirmed by implementation: write path uses only `UPDATE ... WHERE id = vote_id AND profile_id = auth_user_id`; no insert path exists.
