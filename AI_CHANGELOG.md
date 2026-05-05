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

## Entry
Timestamp: 2026-03-22 22:37:05 -04:00  
Type: fix  
Task: Fix re-evaluation vote submit wiring and remove non-caption descriptive rendering  
Files changed:
- `src/app/page.tsx`
- `AI_CHANGELOG.md`
Root cause found (buttons not working):
- Vote submit path used `.maybeSingle()` for `(profile_id, caption_id)` lookup.
- If more than one row exists for that key in current data, `.maybeSingle()` returns an error and server action aborts, so click appears to fail.
Fix applied:
- Switched existing-vote lookup to non-throwing array query with `.limit(1)`.
- Kept write semantics:
  - unchanged vote => skip write
  - existing `(profile_id, caption_id)` => `UPDATE`
  - missing `(profile_id, caption_id)` => `INSERT`
- Kept writes server-side and authenticated via `supabase.auth.getUser()` (`auth.uid()` as `profile_id`).
Rendering fix applied:
- Removed `image_description` text from UI.
- Reduced caption->image query to `images(id,url)` and render only exact linked image + caption text.
Auth impact:
- Auth flow unchanged.
- Middleware and callback remain unchanged.
RLS impact:
- None. No policy changes.
Risk assessment:
- Low. Minimal wiring/render adjustment in page-level feature code only.
Rollback plan:
- Revert `src/app/page.tsx` to previous commit state.
Verification performed:
- Ran `npm test` (`npm run lint`): passed with 0 errors (existing `<img>` warning only).
Confirmation on duplicate prevention behavior:
- Update path is keyed by `(profile_id, caption_id)`; insert occurs only when no row is found for that key.

## Entry
Timestamp: 2026-03-22 22:41:36 -04:00  
Type: correction  
Task: Correct root-cause analysis for non-working vote buttons in prior implementation  
Files changed:
- `AI_CHANGELOG.md`
Corrected analysis:
- Prior explanation over-focused on `.maybeSingle()` duplicate-row failure.
- User verification showed no duplicate `(profile_id, caption_id)` rows, so that is not the operative cause.
Exact `.maybeSingle()` query used previously:
- Table: `caption_votes`
- Filters:
  - `.eq("caption_id", captionId)`
  - `.eq("profile_id", actionUser.id)`
- Projection: `.select("id,vote_value")`
- Method: `.maybeSingle()`
How this could still appear broken with no duplicates:
- The read query can succeed, but the subsequent update path previously filtered by bigint `id`:
  - `.eq("id", existingVote.id).eq("profile_id", actionUser.id).eq("caption_id", captionId)`
- `caption_votes.id` is `bigint`; using JS `number` for `existingVote.id` can lose precision for large ids, causing the update filter to match zero rows without necessarily throwing.
- Result: click submits, but no row changes, appearing as "buttons not working".
Root cause classification:
- Not wrong join.
- Not server action wiring failure.
- Not duplicate-key failure from `.maybeSingle()` in this dataset.
- Most likely: write-path filter precision mismatch on bigint `id` (and overly strict id-based update filter).
Current fix relevance:
- Current code updates by `(profile_id, caption_id)` instead of bigint `id`, avoiding this precision-risk path.
- Rendering fix (remove `image_description`) remains valid and unchanged.

## Entry
Timestamp: 2026-03-22 23:03:34 -04:00  
Type: fix  
Task: Advance to next item immediately after successful vote submission  
Files changed:
- `src/app/page.tsx`
- `AI_CHANGELOG.md`
Brief debug/root cause:
- Page always selected the first eligible caption from the global queue.
- After voting, server action returned to the same page selection logic without excluding the current item, so the same item re-rendered.
Fix applied (minimal):
- Added server-side redirect from vote action to `/?exclude_caption_id=<current_caption_id>` after successful skip/update/insert paths.
- Added page-level `searchParams` handling and excluded `exclude_caption_id` from the next eligible queue selection for that request.
- Kept global selection rule unchanged: DISTINCT `caption_id` from `caption_votes` where `vote_value = -1`.
- Added friendly exhausted state: `You&apos;re done for now.`
Write behavior:
- Unchanged core semantics:
  - authenticated user (`auth.uid()`) as `profile_id`
  - key `(profile_id, caption_id)`
  - unchanged vote => skip write
  - existing vote => update
  - missing vote => insert
Auth impact:
- No auth flow changes.
- Middleware and callback unchanged.
RLS impact:
- None. No policy changes.
Verification performed:
- Ran `npm test` (`npm run lint`) with 0 errors (existing `<img>` warning only).

## Entry
Timestamp: 2026-03-22 23:14:19 -04:00  
Type: fix  
Task: Prevent processed items from reappearing within the same re-evaluation session flow  
Files changed:
- `src/app/page.tsx`
- `AI_CHANGELOG.md`
Brief debug/root cause:
- Prior flow only tracked one exclusion (`exclude_caption_id`), so after voting A then B, redirect excluded only B and A became eligible again.
- Candidate pool was recomputed globally each request without a processed set, causing immediate recycle.
Fix applied (minimal/session-level):
- Replaced single exclusion cursor with `processed_caption_ids` flow state.
- Read `processed_caption_ids` from `searchParams` and treat as processed set for this session flow.
- Keep candidate pool rule unchanged: DISTINCT global `caption_id` where at least one vote row has `vote_value = -1`.
- Select next item from candidate pool minus processed set.
- On successful vote submit (unchanged/update/insert), append current `caption_id` to processed set and redirect to `/?processed_caption_ids=...`.
- If no eligible unprocessed items remain, show `You&apos;re done for now.`
Write behavior:
- Unchanged: auth user as `profile_id`, `(profile_id, caption_id)` semantics, skip unchanged vote, update-or-insert otherwise.
Auth impact:
- No auth flow changes.
- Middleware/callback unchanged.
RLS impact:
- None. No policy changes.
Verification performed:
- Ran `npm test` (`npm run lint`) with 0 errors (existing `<img>` warning only).

## Entry
Timestamp: 2026-03-22 23:37:02 -04:00  
Type: UI-only  
Task: Refactor re-evaluation page presentation to centered dark card layout with dominant image and motion polish  
Files changed:
- `src/app/page.tsx`
- `src/app/globals.css`
- `AI_CHANGELOG.md`
Summary:
- Updated page layout to centered card with max width ~700px on dark gradient background (`#0b0f1a` base).
- Restyled card to `#0f172a`, 24px radius, deep shadow plus subtle purple glow.
- Increased image dominance (`width: 100%`, `max-height: 70vh`, `object-fit: contain`, rounded 16px).
- Caption now centered, larger, and higher-contrast.
- Buttons centered with 16px gap and requested color treatment:
  - No: dark with border
  - Yes: yellow action style
- Added floating card transform defaults/hover:
  - default `translate3d(0,-7px,0)`
  - hover `translate3d(0,-12px,0)`
  - `transformStyle: preserve-3d`
  - `willChange: transform`
- Added subtle entry transition (`0.25s ease`) using fade + upward slide animation to simulate stacked-card progression.
Auth impact:
- None. No auth logic changes.
RLS impact:
- None. No query/policy/write logic changes.
Verification performed:
- Ran `npm test` (`npm run lint`) with 0 errors (existing `<img>` warning only).

## Entry
Timestamp: 2026-03-22 23:48:16 -04:00  
Type: UI-only  
Task: Move vote buttons above content card and tune dark neon color direction  
Files changed:
- `src/app/page.tsx`
- `AI_CHANGELOG.md`
Summary:
- Moved vote action form so layout order is now:
  1) title
  2) question
  3) centered Yes/No buttons
  4) main content card (image + caption)
- Kept floating card behavior and post-vote transition unchanged.
- Updated page/card palette toward richer midnight navy with atmospheric soft glow accents:
  - darker base in `#050816` to `#0B1020` range
  - deep navy card surface around `#08122F`
  - subtle purple (`#7C3AED`) and green (`#22C55E`) glow accents
  - preserved yellow positive action button around `#FBBF24`
  - text tones tuned to near `#F8FAFC` / `#CBD5E1`
Auth impact:
- None. No auth logic changes.
RLS impact:
- None. No query/write/policy changes.
Verification performed:
- Ran `npm test` (`npm run lint`) with 0 errors (existing `<img>` warning only).

## Entry
Timestamp: 2026-03-23 13:46:47 -04:00  
Type: change  
Task: Execute Step1.txt for `/api/caption-pipeline/presigned-url` route behavior  
Files changed:
- `src/app/api/caption-pipeline/presigned-url/route.ts`
- `AI_CHANGELOG.md`
Summary:
- Kept existing authenticated server route structure using Supabase server client.
- Verified route checks `supabase.auth.getUser()` and returns 401 when unauthenticated.
- Verified route fetches `supabase.auth.getSession()` and uses `session.access_token`, returning 401 if missing.
- Verified upstream call target and payload:
  - `POST https://api.almostcrackd.ai/pipeline/generate-presigned-url`
  - body `{ \"contentType\": \"image/jpeg\" }`
- Adjusted response handling to return upstream JSON directly via `NextResponse.json(data, { status })` as required.
Auth impact:
- Auth flow unchanged.
- No service-role keys introduced.
- No client-provided user identity trusted.
RLS impact:
- None. No database policy/query changes.
Risk assessment:
- Low. Route-level response-format alignment only.
Rollback plan:
- Revert `src/app/api/caption-pipeline/presigned-url/route.ts` to previous commit state.
Verification performed:
- Ran `npm test` (`npm run lint`) with 0 errors (existing `<img>` warning only).

## Entry
Timestamp: 2026-03-23 14:13:40 -04:00  
Type: change  
Task: Execute Step2.txt for `/api/caption-pipeline/upload-to-presigned-url` route behavior  
Files changed:
- `src/app/api/caption-pipeline/upload-to-presigned-url/route.ts`
- `AI_CHANGELOG.md`
Summary:
- Added `POST /api/caption-pipeline/upload-to-presigned-url` App Router route.
- Route accepts JSON body with `sourceImageUrl`, `presignedUrl`, and `contentType`.
- Server flow implemented with async/await:
  - fetch `sourceImageUrl`
  - read bytes via `arrayBuffer()`
  - `PUT` bytes to `presignedUrl` with `Content-Type` header from request body
- Success response shape: `{ "ok": true, "uploadStatus": <status> }`.
- Failure behavior implemented per step instructions:
  - if source fetch fails, returns upstream status + body text
  - if presigned PUT fails, returns upstream status + body text
- Added `try/catch` with `console.error` and 500 fallback.
Auth impact:
- None. No auth logic changes.
RLS impact:
- None. No database policy/query changes.
Verification performed:
- Ran `npm test` (`npm run lint`) with 0 errors (existing `<img>` warning only).

## Entry
Timestamp: 2026-03-23 15:15:10 -04:00  
Type: change  
Task: Create `src/app/api/caption-pipeline/register-image/route.ts`  
Files changed:
- `src/app/api/caption-pipeline/register-image/route.ts`
- `AI_CHANGELOG.md`
Summary:
- Added new App Router API route file for `POST /api/caption-pipeline/register-image`.
- Implemented a minimal TypeScript-compatible stub that returns HTTP 501 with a JSON body.
Auth impact:
- None. No auth logic changes.
RLS impact:
- None. No database policy/query changes.
Verification performed:
- Ran `npm test` (`npm run lint`) with 0 errors (existing `<img>` warning only).

## Entry
Timestamp: 2026-03-23 15:23:37 -04:00  
Type: change  
Task: Execute Step4.txt for `/api/caption-pipeline/register-image` route behavior  
Files changed:
- `src/app/api/caption-pipeline/register-image/route.ts`
- `AI_CHANGELOG.md`
Summary:
- Replaced placeholder implementation with real `POST /api/caption-pipeline/register-image` App Router handler.
- Added server-side Supabase auth checks with `supabase.auth.getUser()` and `supabase.auth.getSession()`.
- Returns `401` JSON when user is unauthenticated or access token is missing.
- Reads JSON body with `imageUrl` and `isCommonUse`, defaults `isCommonUse` to `false`.
- Returns `400` JSON when `imageUrl` is missing.
- Calls upstream `POST https://api.almostcrackd.ai/pipeline/upload-image-from-url` with bearer token and JSON body.
- Returns upstream JSON directly with upstream status code.
- Added `try/catch` with `console.error` and `500` fallback.
Auth impact:
- Auth checks were added to this route and follow existing server-side auth patterns.
- No auth bypasses introduced; unauthenticated requests are rejected with `401`.
RLS impact:
- None. No database policy/query changes.
Risk assessment:
- Low to medium. Route now depends on valid session/token and upstream API availability/response shape.
Rollback plan:
- Revert `src/app/api/caption-pipeline/register-image/route.ts` to the previous placeholder commit state.
Verification performed:
- Ran `npm test` (`npm run lint`) with 0 errors (existing `<img>` warning only).

## Entry
Timestamp: 2026-03-23 15:40:08 -04:00  
Type: change  
Task: Add `/api/caption-pipeline/generate-captions` server route  
Files changed:
- `src/app/api/caption-pipeline/generate-captions/route.ts`
- `AI_CHANGELOG.md`
Summary:
- Added `POST /api/caption-pipeline/generate-captions` App Router route.
- Uses server-side Supabase auth checks via `supabase.auth.getUser()` and `supabase.auth.getSession()`.
- Returns `401` JSON for missing user or missing access token.
- Validates request body and returns `400` JSON when `imageId` is missing.
- Calls upstream `POST https://api.almostcrackd.ai/pipeline/generate-captions` with bearer token and JSON body `{ imageId }`.
- Returns upstream JSON directly with upstream status.
- Uses async/await with `try/catch` and `console.error`.
Auth impact:
- Added auth enforcement for the new route following existing server-only auth patterns.
- No auth bypasses introduced; unauthenticated access is rejected.
RLS impact:
- None. No database policy/query changes.
Risk assessment:
- Low to medium. Depends on valid Supabase session token and upstream API response behavior.
Rollback plan:
- Revert `src/app/api/caption-pipeline/generate-captions/route.ts`.
Verification performed:
- Ran `npm test` (`npm run lint`) with 0 errors (existing `<img>` warning only).

## Entry
Timestamp: 2026-03-23 16:12:19 -04:00  
Type: change  
Task: Execute Step5.txt image upload modal and caption pipeline UI flow  
Files changed:
- `src/app/upload-modal.tsx`
- `src/app/page.tsx`
- `src/app/api/caption-pipeline/presigned-url/route.ts`
- `AI_CHANGELOG.md`
Summary:
- Added client upload modal component with dark neon/floating-card styling and top-right `Upload` button integration on main page.
- Modal includes:
  - image file input (accepted MIME types: jpeg/jpg/png/webp/gif/heic)
  - local preview of selected image
  - submit button with loading/disabled state
  - close button and outside-click close behavior
  - inline user-friendly error and success states
- Implemented client pipeline flow in order:
  1. `POST /api/caption-pipeline/presigned-url` with selected file `contentType`
  2. `PUT` selected file bytes to returned `presignedUrl`
  3. `POST /api/caption-pipeline/register-image` with returned `cdnUrl`
  4. `POST /api/caption-pipeline/generate-captions` with resolved `imageId`
- On success, stores generated captions payload in component state and logs it for future UI usage.
- Updated `/api/caption-pipeline/presigned-url` route to accept optional request `contentType` while defaulting to `image/jpeg`.
Auth impact:
- Existing auth checks in `/api/caption-pipeline/presigned-url` (`getUser`, `getSession`, token validation) were preserved unchanged.
- No client-provided user identity is trusted; secure calls still route through existing server API endpoints.
RLS impact:
- None. No database policy/query changes.
Risk assessment:
- Medium. UI flow now depends on multi-step API success and upstream response field consistency (`presignedUrl`, `cdnUrl`, `imageId`).
Rollback plan:
- Revert:
  - `src/app/upload-modal.tsx`
  - `src/app/page.tsx`
  - `src/app/api/caption-pipeline/presigned-url/route.ts`
Verification performed:
- Ran `npm test` (`npm run lint`) with 0 errors (existing `<img>` warning only).

## Entry
Timestamp: 2026-03-23 17:03:19 -04:00  
Type: UI/UX change  
Task: Execute Step6.txt upload modal refinement  
Files changed:
- `src/app/upload-modal.tsx`
- `AI_CHANGELOG.md`
Summary:
- Updated modal subtitle to: `Select an image to upload and create your own Humor Content.`
- Updated file label to: `Image File (JPG, JPEG, PNG, WEBP, GIF, HEIC)`.
- Kept selection and submission as separate actions (no auto-submit on file pick).
- Added explicit `Discard` behavior before submission:
  - clears selected file
  - clears preview
  - clears status/error/success state
  - clears generated captions
  - keeps modal open
- Improved submission states with step-oriented loading text (`Preparing upload...`, `Uploading image...`, `Registering image...`, `Generating captions...`) and button disable handling.
- Removed developer-facing raw JSON output and debug display from UI.
- Added user-facing caption results panel with clean card list presentation in a modern scrollable container matching dark neon styling.
- Kept close behavior clean: closing the modal resets state so reopening starts fresh.
Auth impact:
- None. No auth logic changes.
RLS impact:
- None. No database policy/query changes.
Verification performed:
- Ran `npm test` (`npm run lint`) with 0 errors (existing `<img>` warning only).
## Entry
Timestamp: 2026-03-29 14:04:33 -04:00  
Type: UI/UX enhancement  
Task: Execute ui-improvement.txt onboarding + ambient audio updates  
Files changed:
- `src/app/page.tsx`
- `src/app/intro-audio-shell.tsx`
- `public/make-it-weirder.mp3`
- `AI_CHANGELOG.md`
Summary:
- Added a client-side intro/onboarding overlay shown on first visit only, persisted with `localStorage` key `hasSeenIntro`.
- Added the exact project-purpose intro copy and `Continue` action in a centered dark-theme modal with dimmed blurred backdrop.
- Added looping background audio (`/make-it-weirder.mp3`) at low default volume (`0.3`).
- Ensured audio starts only after user interaction: on intro `Continue` and also on first vote button interaction.
- Added fixed bottom-right circular mute toggle with icon state (`??` / `??`) and persisted preference via `localStorage` key `isMuted`.
- Kept voting logic, queue logic, Supabase querying, middleware, redirects, and auth flow unchanged.
Auth impact:
- None. No auth logic changes.
RLS impact:
- None. No database policy/query changes.
Risk assessment:
- Low. Changes are client-side UI/interaction only and wrapped around existing page output without modifying server actions.
Rollback plan:
- Revert:
  - `src/app/page.tsx`
  - `src/app/intro-audio-shell.tsx`
  - `public/make-it-weirder.mp3`
Verification performed:
- Ran `npm test` (`npm run lint`) successfully with 0 errors.
- Remaining warning is pre-existing/non-blocking: `@next/next/no-img-element` in `src/app/page.tsx`.
## Entry
Timestamp: 2026-03-29 14:22:06 -04:00  
Type: Bug fix (audio lifecycle)  
Task: Keep ambient audio persistent across vote/content transitions  
Files changed:
- src/app/layout.tsx
- src/app/page.tsx
- src/app/intro-audio-shell.tsx
- AI_CHANGELOG.md
Summary:
- Fixed root cause of audio restart/pause by moving IntroAudioShell mount from src/app/page.tsx to persistent src/app/layout.tsx.
- Removed vote-click-driven audio startup logic so playback is no longer coupled to vote interactions.
- Kept audio object initialized once per app shell mount, preserving currentTime across content transitions and page re-renders within the app route.
- Updated Continue behavior to start playback from currentTime = 0 and then continue uninterrupted with loop = true.
- Kept isMuted and hasSeenIntro localStorage persistence intact.
- Scoped intro/mute UI to the home route while keeping the audio owner at stable top level.
Auth impact:
- None. No auth logic changes.
RLS impact:
- None. No database policy/query changes.
Risk assessment:
- Low. Client-side lifecycle placement change only; no server action/query/auth changes.
Rollback plan:
- Revert:
  - src/app/layout.tsx
  - src/app/page.tsx
  - src/app/intro-audio-shell.tsx
Verification performed:
- Ran 
pm test (
pm run lint) successfully with 0 errors.
- Existing non-blocking warning remains for <img> usage in src/app/page.tsx.
## Entry
Timestamp: 2026-05-01 08:49:38 -04:00
Type: Bug fix (audio persistence hardening)
Task: Keep ambient audio alive across remounts and hard navigations
Files changed:
- `src/app/intro-audio-shell.tsx`
- `AI_CHANGELOG.md`
Summary:
- Reworked intro audio ownership to reuse a singleton `Audio` instance stored on `window`, so the player no longer depends on a single React mount surviving.
- Added `sessionStorage`-backed playback persistence for `currentTime` and playing state, allowing the shell to restore audio position after remounts or a full document navigation.
- Resume logic now attempts to restart previously playing audio on mount and when the user unmutes after a paused restore.
- Preserved existing intro gating and mute persistence behavior; no auth, query, or vote flow changes.
Auth impact:
- None. No auth logic changes.
RLS impact:
- None. No database policy/query changes.
Risk assessment:
- Low. Client-side audio lifecycle only; no server or auth behavior changed.
Rollback plan:
- Revert:
  - `src/app/intro-audio-shell.tsx`
Verification performed:
- Ran `npm test` after the change.
## Entry
Timestamp: 2026-05-05 11:10:00 -04:00
Type: UI/flow update (public landing, protected onboarding)
Task: Replace the root page with a public landing experience and add post-login onboarding without breaking existing auth, upload, or voting behavior
Files changed:
- `src/app/page.tsx`
- `src/app/hero.tsx`
- `src/app/background-grid.tsx`
- `src/app/neon-wordmark.tsx`
- `src/app/decorative-orbitals.tsx`
- `src/app/star-field.tsx`
- `src/app/theme-toggle.tsx`
- `src/app/review-app.tsx`
- `src/app/protected/page.tsx`
- `src/app/protected/protected-app-shell.tsx`
- `src/app/protected/sign-out-button.tsx`
- `src/app/intro-audio-shell.tsx`
- `src/app/auth/callback/route.ts`
- `middleware.ts`
- `src/app/globals.css`
- `AI_CHANGELOG.md`
Summary:
- Replaced the root route with a public neon landing page that delays the `Start` CTA, keeps the existing login mechanism, and routes authenticated users directly to the protected app.
- Extracted the existing caption review experience into a reusable protected server component and wrapped it in a client shell that adds theme switching, logout, onboarding, and the persistent `?` help control next to Upload.
- Added a CSS/SVG-based visual system for the landing/protected UI, including a grid/ring backdrop, orbitals, neon wordmark treatment, and a canvas particle layer with cursor repulsion.
- Preserved upload functionality and vote progression behavior while moving the protected app surface from `/` to `/protected`.
Auth impact:
- Middleware route protection moved from `/` to `/protected` so the new public landing page is accessible before login.
- OAuth callback redirect target changed from `/` to `/protected` so successful login lands in the authenticated onboarding/app flow.
- Existing middleware auth checks, `supabase.auth.getUser()` checks, redirects to `/login`, and callback exchange logic remain in place.
RLS impact:
- None. No database policy/query changes.
Risk assessment:
- Medium-low. Auth invariants remain intact, but the protected route path changed from `/` to `/protected`, so regressions would most likely surface as incorrect post-login routing.
Rollback plan:
- Revert:
  - `src/app/page.tsx`
  - `src/app/hero.tsx`
  - `src/app/background-grid.tsx`
  - `src/app/neon-wordmark.tsx`
  - `src/app/decorative-orbitals.tsx`
  - `src/app/star-field.tsx`
  - `src/app/theme-toggle.tsx`
  - `src/app/review-app.tsx`
  - `src/app/protected/page.tsx`
  - `src/app/protected/protected-app-shell.tsx`
  - `src/app/protected/sign-out-button.tsx`
  - `src/app/intro-audio-shell.tsx`
  - `src/app/auth/callback/route.ts`
  - `middleware.ts`
  - `src/app/globals.css`
Verification performed:
- Ran `npm test` successfully.
- Existing non-blocking `@next/next/no-img-element` warning remains in `src/app/review-app.tsx`.
## Entry
Timestamp: 2026-05-05 13:42:00 -04:00
Type: Queue logic update (caption-image weekly shuffle)
Task: Rotate weekly downvoted caption-image pairs by user history while avoiding back-to-back duplicate images
Files changed:
- `src/app/review-app.tsx`
- `src/app/review-seen-tracker.tsx`
- `src/app/vote-controls.tsx`
- `AI_CHANGELOG.md`
Summary:
- Reworked the review queue to operate on caption-image pairs rather than image-only items, so different captions attached to the same downvoted image can still appear later in the weekly queue.
- Built a weekly round-robin shuffle over distinct images: the first pass shows one caption per image, then later passes surface additional captions for those images only after the distinct-image pass completes.
- Added a back-to-back image guard so, when alternatives exist, the next selected pair does not reuse the image shown immediately before it.
- Added client-persisted seen-caption and last-image tracking for the active week so users returning mid-queue continue from unseen caption-image pairs instead of restarting the same items.
- Corrected vote navigation to continue advancing inside `/protected`.
Auth impact:
- None. No auth logic changes.
RLS impact:
- None. No database policy/query changes.
Risk assessment:
- Medium. Queue selection now depends on weekly vote timestamps, persisted seen-caption cookies, and deterministic shuffle logic, so regressions would most likely appear as an unexpectedly empty queue or surprising ordering.
Rollback plan:
- Revert:
  - `src/app/review-app.tsx`
  - `src/app/review-seen-tracker.tsx`
  - `src/app/vote-controls.tsx`
Verification performed:
- Ran `npm test` successfully.
- Ran `npm run build` successfully.
- Existing non-blocking `@next/next/no-img-element` warning remains in `src/app/review-app.tsx`.
## Entry
Timestamp: 2026-05-01 09:02:00 -04:00
Type: Bug fix (vote navigation lifecycle)
Task: Prevent full-page vote redirects from interrupting persistent audio
Files changed:
- `src/app/page.tsx`
- `src/app/vote-controls.tsx`
- `AI_CHANGELOG.md`
Summary:
- Replaced the vote form submit + server-side `redirect()` flow with a client vote control that calls a server action and then updates `processed_caption_ids` via `router.replace()`.
- Kept the vote mutation on the server, but changed it to return the next processed caption list instead of forcing a document navigation.
- This keeps vote progression inside the current document so the persistent intro audio shell is not torn down by a full page load.
Auth impact:
- None. No auth logic changes.
RLS impact:
- None. No database policy/query changes.
Risk assessment:
- Low. Vote UI flow changed from full redirect to client navigation, but the same server-side user check and database writes remain in place.
Rollback plan:
- Revert:
  - `src/app/page.tsx`
  - `src/app/vote-controls.tsx`
Verification performed:
- Ran `npm test` after the change.
