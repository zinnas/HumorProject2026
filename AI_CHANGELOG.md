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

## Entry
Timestamp: 2026-03-22 22:14:02 -04:00  
Type: change  
Task: Apply Supabase setup updates (dependency check, env vars, helper clients, middleware session refresh integration)  
Files changed:
- `.env.local`
- `src/utils/supabase/server.ts`
- `src/utils/supabase/client.ts`
- `src/utils/supabase/middleware.ts`
- `middleware.ts`
- `AI_CHANGELOG.md`
Summary:
- Ran `npm install @supabase/supabase-js` (already up to date).
- Added `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`.
- Updated Supabase server/browser helpers to read `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` with fallback to `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Added `src/utils/supabase/middleware.ts` with cookie-refresh/session-update helper.
- Updated root middleware to use the helper while preserving existing protected-route redirect behavior.
Auth changes (explicit + safety):
- Changed: middleware session refresh logic is now centralized in `src/utils/supabase/middleware.ts`.
- Preserved: protected-route enforcement still requires `supabase.auth.getUser()` and redirects unauthenticated users to `/login`.
- Preserved: no callback/auth route changes, no client-trusted user IDs, no service-role usage.
RLS impact:
- None. No policy or role changes.
Risk assessment:
- Low to moderate. Auth-sensitive files changed, but behavior-preserving fallback and redirect checks were retained.
Rollback plan:
- Revert `middleware.ts` and `src/utils/supabase/middleware.ts` to prior direct middleware client usage.
- Revert `src/utils/supabase/server.ts` and `src/utils/supabase/client.ts` env-key fallback changes.
- Remove `.env.local` additions if needed.
Verification performed:
- Ran `npm test` (`npm run lint`) successfully with no errors (one existing `<img>` warning in `src/app/page.tsx`).
- Confirmed auth redirect logic remains present in `middleware.ts`.

## Entry
Timestamp: 2026-03-22 22:28:45 -04:00  
Type: change  
Task: Align re-evaluation feature with global downvote queue and `(profile_id, caption_id)` write semantics  
Files changed:
- `src/app/page.tsx`
- `AI_CHANGELOG.md`
Schema inspected:
- `schema.sql` (repo root; `supabase/schema.sql` not present in repository)
- Relationships used:
  - `caption_votes.caption_id -> captions.id`
  - `captions.image_id -> images.id`
Selection logic (separate from write logic):
- Selection source is global `public.caption_votes` rows where `vote_value = -1`.
- Queue key is DISTINCT `caption_id` (deduped in app from selected rows).
- Selection is NOT filtered by current authenticated user.
- One caption/image pair is rendered at a time from exact DB-linked rows.
Write logic:
- Writer identity is current `auth.uid()` and is used as `profile_id`.
- Uniqueness key is `(profile_id, caption_id)` at app level.
- On vote:
  - if existing row for `(profile_id, caption_id)` exists and value changed: `UPDATE`
  - if existing row exists and value unchanged: skip write
  - if no existing row: `INSERT`
- Avoided manual writes to trigger-managed audit fields (`created_by_user_id`, `modified_by_user_id`, `modified_datetime_utc`).
Auth impact (confirm unchanged):
- Auth flow unchanged.
- Server-side `supabase.auth.getUser()` checks and redirects remain intact.
- No middleware/callback/client-server auth weakening introduced by this change.
RLS impact:
- None. No policy changes.
Risk assessment:
- Low to moderate. Main risk is dependence on expected unique behavior for `(profile_id, caption_id)` in live DB.
Rollback plan:
- Revert `src/app/page.tsx` to prior implementation.
- No schema or policy rollback needed.
Verification performed:
- Ran `npm test` (`npm run lint`) with 0 errors (existing `<img>` warning only).
- Confirmed write path updates existing rows or inserts only when absent, and skips unchanged votes.
Confirmation that existing rows are updated and not duplicated:
- Implemented explicit existing-row check by `(profile_id, caption_id)` before write.
- Existing matching row uses `UPDATE`, not `INSERT`.
