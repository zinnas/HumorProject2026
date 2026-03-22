# AGENTS.md

Project-level instructions for AI/code agents working in this repository.

## Core Working Rules
- Prefer minimal, safe changes that preserve existing behavior.
- Do not refactor authentication unless explicitly instructed.
- Preserve all existing redirects and session handling.
- Always run `npm test` after modifying JavaScript/TypeScript source files.
- Prefer `pnpm` when installing dependencies.
- Ask for confirmation before adding new production dependencies.
- If database structure is needed, refer to `schema.sql`.

## AUTH INVARIANTS (CRITICAL)
- Never modify authentication flow without explicit instruction.
- Never remove or bypass:
  - `middleware.ts` auth checks
  - `supabase.auth.getUser()` checks in server components
  - OAuth callback logic in `/auth/callback/route.ts`
- Never expose protected data to unauthenticated users.
- Never convert server-side auth logic to client-side unless explicitly required.
- Never remove redirects that protect routes (for example, redirect to `/login`).
- Any change touching auth MUST:
  - explicitly state what changed
  - explain why it is safe
  - be logged in `AI_CHANGELOG.md`

## Sensitive Auth Files
Treat these files and call-sites as sensitive and high-risk:
- `middleware.ts`
- `src/utils/supabase/server.ts`
- `src/utils/supabase/client.ts`
- `src/app/auth/callback/route.ts`
- Any code calling `supabase.auth.*`

## Required Before Changing Auth
- Read the latest `AI_CHANGELOG.md` entries first.
- Explain the intended auth change before making edits.
- Preserve existing behavior unless the user explicitly requests an auth behavior change.

## Logging Rules
- Always append to `AI_CHANGELOG.md`.
- Never overwrite, rewrite, or summarize prior changelog entries.
- For auth-related changes, include:
  - risk assessment
  - rollback plan

## File Preservation Rule
- `AGENTS.md` and `AI_CHANGELOG.md` are append/update-safe instruction artifacts.
- Do not overwrite these files in the future. Only make additive or minimally scoped edits that preserve existing history and rules.
