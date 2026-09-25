# Movie Match — project memory

This file is the persistent context for this project. It lives in the repo (not in any
account-scoped Claude memory), so it survives switching Claude accounts, machines, or
Claude Code sessions entirely — anyone opening this directory picks up full context here.
**Keep this updated as the project evolves** — when you (Claude) make a non-trivial
decision, fix a real bug, or change direction, add it here before ending the session.

## What this is
A two-device movie/TV matchmaker for couples who can't agree what to watch. Partner A sets
preferences, shares a QR/link, Partner B joins and sets their own preferences independently.
Gemini reconciles both into a search brief, TMDB supplies a candidate pool, both partners
swipe simultaneously on synced decks, and a Postgres trigger detects mutual right-swipes in
real time — no polling. Up to two refinement rounds, then a top-5 fallback. Shows real
Indian OTT availability via RapidAPI. Full spec was given by the user at project start —
see conversation history if the original brief is needed verbatim.

## Tech stack
- Next.js 15 (App Router) + TypeScript, Tailwind CSS v3
- Supabase (Postgres + Realtime) — project ref `vsdrbymbwsyqyiqguoqy`, region ap-southeast-1
- **Gemini** (not Claude/Anthropic) for brief generation — see "Why Gemini" below
- TMDB for title discovery/metadata
- RapidAPI "Streaming Availability" (movie-of-the-night) for Indian OTT platforms + IMDb rating
- framer-motion (swipe cards), qrcode (QR generation), zod (validation)

### Why Gemini, not Claude
The original spec explicitly said "Claude" for the AI step, and `lib/claude.ts` was built
that way first (Anthropic SDK, tool-use for structured output). The user didn't have an
Anthropic API key but did have a **paid** Gemini key, so it was swapped to `lib/gemini.ts`
(`@google/genai` SDK, `responseSchema` JSON mode instead of tool-use). Model is
`gemini-flash-latest` (an alias that tracks Google's current stable release, chosen
specifically to avoid hardcoding a dated snapshot that goes stale). If the user later gets
an Anthropic key and wants to switch back, `lib/claude.ts`'s original implementation is in
git history (commit before the Gemini swap) — same three-function shape
(`buildBrief`/`refineFromLikes`/`summarizeTaste`), just re-point the imports.

## Environment / credentials
Real keys live in `.env.local` (gitignored, never committed — verified clean before every
commit). `.env.example` documents every var with no real values. Current key inventory the
user provided (do not ask again unless they say a key changed):
- Supabase URL/publishable/secret keys — live project, schema already pushed
- `SUPABASE_ACCESS_TOKEN` — a personal Management API token, used only for one-off schema
  pushes via `https://api.supabase.com/v1/projects/{ref}/database/query` (curl), not read by
  the app itself. Useful again if `supabase/schema.sql` changes and needs re-pushing.
- TMDB API key (v3)
- RapidAPI key, subscribed to the Streaming Availability API specifically (the user had to
  subscribe on RapidAPI's marketplace separately from generating the key — free Basic tier)
- Gemini API key (paid tier — no training-on-data concern)
- `GEMINI_API_KEY`/`GITHUB_PERSONAL_ACCESS_TOKEN` the user also pasted are **not** used by
  this app's code (no GitHub API integration exists here)

## GitHub
Repo: https://github.com/Vishweshwar-Mesa/Movie-Match (public — that's how the user had
already created it; no secrets in the repo, safe as public). `gh` CLI is installed at
`~/.local/bin/gh` (not on PATH by default in non-interactive tool sessions — either
`export PATH="$HOME/.local/bin:$PATH"` or call it by full path) and authenticated via a
classic PAT with `repo` scope only (missing `read:org`, which is fine — that scope is only
needed for org features, not repo/push/PR work). git's credential helper is wired to `gh`
(`gh auth setup-git` was run), so plain `git push`/`git pull` work with no manual token
handling. Global git identity is set to the user's real name/email.

## Deployment
**Not deployed anywhere yet.** User explicitly wants to test locally first before touching
Vercel — asked about it once, then said "leave vercel, lets test and then we'll see about
live." Don't deploy without them asking again.

## Non-obvious bugs already found and fixed (don't reintroduce)
1. **TMDB `with_genres` AND vs OR**: comma-joined genre IDs (`28,12,35`) means "must match
   ALL of these genres simultaneously," not any of them — near-zero results for realistic
   multi-genre briefs. Fixed to pipe-joined (`28|12|35`) in `lib/tmdb.ts` `discoverTitles`.
2. **`vote_count.gte` too strict for regional/niche content**: hardcoded `20` returned zero
   results for large swaths of language×era×rating combos (verified via full sweep — 63 of
   192 combos were zero, worst offender: any regional language + "Include series"). TMDB
   *has* the titles, they're just thinly voted. Fixed with a relaxation ladder in
   `lib/pool.ts` (`buildPool`): tries genre-filtered @ vote_count≥20, then no-genre @ 20, @5,
   @1 — stops as soon as it has ≥10 candidates. Never relaxes language/era/rating (the
   couple's actual choices), only the genre filter and the vote-count quality bar. Two
   combos remain genuinely zero even after full relaxation (Kannada TV, 9+ rating, classic
   or recent era) — that's a real content floor on TMDB, not a bug; matches the "very few
   titles" caveat the form already shows for 9+.
3. **RapidAPI Streaming Availability rating field**: the response has no `imdbRating` field —
   just `rating`, on a **0–100 scale** (70 = 7.0), not 0–10. `lib/streamingAvailability.ts`
   divides by 10. Was silently showing "70.0" ratings before this was caught.
4. **SwipeDeck blank-screen bug** (found via real user testing, not caught by automated
   tests beforehand): `SwipeDeck` used to track its own `index` state into the `titles`
   array, but the parent (`SessionClient`) passes a *shrinking* array every render (already-
   swiped titles filtered out). Both advancing together meant position advanced ~2x too
   fast — `index` overran the array almost exactly halfway through a round (confirmed: user
   hit it at swipe 15 of a 30-card deck), and the component silently `return null`ed — blank
   screen, no console error. Fixed by removing the internal index entirely: current card is
   always `titles[0]`, the shrinking prop array alone drives progression. Verified with an
   automated full 30-swipe run through the real UI (Playwright) after the fix — no blank,
   correct "waiting for partner" screen at the true end.

## Testing approach that works in this sandboxed environment
No interactive browser available directly, but Playwright works when installed fresh each
time (`npx --yes playwright install chromium`, browsers aren't cached between sessions):
launch headless Chromium, seed `localStorage` (`movie-match:device-id`,
`movie-match:role:<sessionId>`) to impersonate a partner without going through the real
join flow, drive real clicks/drags, screenshot, check `console --errors`. Combine with
direct `curl` calls to the app's own API routes (fast, for setting up test state — e.g.
create session → join → submit both partners' prefs) and direct Supabase Management API
calls (`curl` to `https://api.supabase.com/v1/projects/{ref}/database/query` with
`SUPABASE_ACCESS_TOKEN`) for DB assertions/cleanup. **Always delete test sessions from
Supabase after testing** — real project, no separate test env. Scratchpad
(`/private/tmp/claude-501/.../scratchpad`) is where throwaway test scripts/screenshots go,
never the project directory. Note: raw `/tmp` writes were unreliable in one sandbox
instance (silent no-op) — scratchpad worked every time.

The "run" skill (browser-driven pattern) is the right entry point for this kind of testing
when it comes up again — see its `examples/playwright.md`.

## Current status (update this section as things change)
- Full app built, deployed to no hosting yet, runs locally via `npm run dev` on :3000
- Supabase schema live and verified (6 tables, match-detection trigger, realtime publication)
- Full pipeline verified end-to-end with real keys: session → join → prefs → Gemini brief →
  TMDB pool → RapidAPI enrichment → swipe → DB-trigger match → rating → done
- All screens visually verified via real browser automation: preference form, QR share,
  swipe deck (including the full-deck fix above), match reveal, rating prompt, final five
- PWA "Add to Home Screen" support added (manifest, generated icons, iOS meta tags)
- Pushed to GitHub, `gh` CLI fully working for future pushes
- **Not yet done**: real two-device test (only ever tested single-browser-as-both-partners
  via API calls, or one real device — never two simultaneous live devices watching realtime
  sync each other); Vercel deployment (paused, waiting on user); the "gets smarter over
  time" couple-history feature (`lib/history.ts` + `summarizeTaste`) is coded but never
  exercised with a real repeat couple (needs two full sessions back-to-back, same two
  device IDs, first one rated, to confirm the second session's brief actually reflects it)
