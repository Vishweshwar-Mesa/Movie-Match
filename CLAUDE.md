# Movie Match — project memory

> **If you are Claude, reading this at the start of a session: this file is how you know
> this project, independent of which Claude account is logged in.** It lives in the repo,
> not in any account-scoped memory system, specifically so that switching Claude accounts,
> machines, or starting a brand-new session never loses context. Read this whole file before
> doing anything else in this project.
>
> **You are required to keep it updated — this is a standing instruction from the user, not
> a one-time favor.** The moment you make a non-trivial decision, find and fix a real bug,
> verify (or break) a feature, change direction, or learn something that would've been
> useful to know at the start of this session — edit this file right then, in the same turn,
> before moving on to the next thing. Don't wait for a natural stopping point, don't wait to
> be asked. Bundle the edit into whatever commit you're already making; it doesn't need to be
> its own commit every time, but it does need to happen every time something changes. If you
> finish a session without having touched this file and something changed, you did it wrong.
>
> Keep entries factual and specific (file paths, exact values, what was tried and what
> happened) over vague summaries — the next reader needs to act on this, not just feel
> informed.

## What this is, and why (the essence)
A movie/TV matchmaker for **two people** who can never agree what to watch — the point is to
end scrolling-and-negotiating and land on one thing both people actually want, fast, with
exactly where to stream it in India, right now. This is not a general recommendation engine
and not a single-user watchlist tool — the two-person, independent-then-reconciled,
swipe-to-consensus mechanic *is* the product. Every design decision should serve "stop
scrolling, stop negotiating, watch something tonight."

**The flow, as specified by the user:**
1. Partner A opens the app, sets preferences:
   - Mood (multi-select): Light & fun / Intense & gripping / Scary / Romantic / Other
   - Mood (free text, optional): "Describe what you're in the mood for tonight" — used to
     add nuance beyond the checkboxes, fed to the AI brief step with equal weight
   - Language (multi-select): Hindi / English / Tamil / Telugu / Kannada / Any — picking
     Any deselects the rest (mutually exclusive with specific picks)
   - Content type (single-select): Movies only / Include series
   - Minimum rating (single-select): 6+ / 7+ / 8+ / 9+ — 9+ shows a "very few titles" caveat
     in the UI (this is a real, verified constraint — see bugs section, not just a UX hedge)
   - Era (multi-select): Any / Classic (pre-2000) / 2000–2020 / Recent (2021–2026) — Any
     deselects the rest
2. App generates a **QR code** Partner A shares with Partner B; scanning lands Partner B in
   the same session. A shareable **link** is the fallback if scanning doesn't work. Partner A
   can also share the QR **as an image** directly to any messaging app (native share sheet).
3. Partner B fills the *same form*, independently — **never sees Partner A's answers**.
4. Once both submit, the AI reads **both** profiles — structured fields *and* free-text mood
   together — and generates a refined search brief. That brief drives a pull of **30 titles**
   from TMDB satisfying both people's preferences, mood nuance included.
5. Both partners see the *same* 30 titles as swipeable cards (poster, title, year, IMDb
   rating, runtime, one-line synopsis) — swipe right = like, left = pass. **Order is
   randomized independently per partner** (not the same shuffle for both).
6. A match — both right-swiped the same title — shows on **both screens simultaneously**,
   full title details, and **exactly which Indian OTT platforms** it's on right now, with a
   direct link to each.
7. No match after round 1 → the AI reads both right-swipe lists from that round and generates
   a new 30-title pool leaning into what both partners actually responded to, deduplicated
   against round 1. One more round of swiping.
8. Still no match after round 2 → show the **top 5** by combined right-swipe score, let both
   partners decide together (no more swiping — a manual pick).
9. The full session — both preference profiles, full swipe history, the match, and a
   post-watch rating either partner can add later — is saved. **Every return visit, history
   loads and the pool gets refined based on what the couple actually enjoyed together**
   (not just what they thought they'd enjoy going in) — this is a standing feature, not a
   one-off: the AI step should get better for a given pair over repeated use.

**Design philosophy** (the user's own words, worth preserving verbatim-ish): should feel like
something a real product team built — clean, mobile-friendly, fun without being childish.
Swiping must feel smooth and satisfying. Each card gives the title enough space to make its
case. The match moment should feel like an *event*, not just a result. Keep it simple — every
element on screen earns its place. Judge new UI work against this bar, not just "does it
work."

**Four required external connections** (all API keys as env vars, never hardcoded — this was
an explicit, repeated requirement): an AI model for brief generation + long-term learning
from watch history (see "Why Gemini, not Claude" below), TMDB for titles/posters/
ratings/metadata, RapidAPI for live Indian OTT availability, Supabase for all persistence.

## Tech stack
- Next.js 15 (App Router) + TypeScript, Tailwind CSS v3
- Supabase (Postgres + Realtime) — project ref `vsdrbymbwsyqyiqguoqy`, region ap-southeast-1
- **Gemini** (not Claude/Anthropic) for brief generation — see below
- TMDB for title discovery/metadata
- RapidAPI "Streaming Availability" (movie-of-the-night) for Indian OTT platforms + IMDb rating
- framer-motion (swipe cards), qrcode (QR generation), zod (validation)
- No auth/accounts — identity is a `device_id` UUID in `localStorage`; sessions are
  capability-secured by their unguessable UUID (the join link/QR *is* the access control)

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

## Architecture map (where things live)
- `app/page.tsx` — landing, "Start a Match Night" → creates session as Partner A
- `app/join/[id]/page.tsx` — QR/link target for Partner B
- `app/session/[id]/SessionClient.tsx` — the whole session state machine; renders the right
  screen based on `session.status` + this device's role (a/b); owns all Supabase Realtime
  subscriptions (sessions/matches/preferences/swipes) and the round-completion check
- `app/session/[id]/{PreferenceForm,QRShare,SwipeDeck,MatchReveal,FinalFive,RatingPrompt}.tsx`
  — the individual screens
- `app/api/sessions/**` — route handlers (server-only, service-role Supabase client): create,
  join, preferences (triggers pool gen), swipe, advance-round, finalize, rating
- `lib/gemini.ts` — the three AI calls (buildBrief/refineFromLikes/summarizeTaste)
- `lib/tmdb.ts` — TMDB discover/genre/runtime calls
- `lib/pool.ts` — orchestrates brief→TMDB→enrichment into a title pool, with the relaxation
  ladder (see bugs section)
- `lib/streamingAvailability.ts` — RapidAPI client
- `lib/history.ts` — pulls a couple's past sessions (by `pair_key`) for the "gets smarter
  over time" step
- `lib/supabase.ts` — browser client (anon key, realtime/reads) + server client (service
  role, writes) + `makePairKey` (sorted device-id pair, identifies a couple across sessions)
- `supabase/schema.sql` — full schema + the match-detection trigger (see below) + RLS
- `CLAUDE.md` — this file

### The real-time match mechanism (the cleverest part, don't break it)
No polling anywhere. A Postgres trigger (`check_for_match` in `supabase/schema.sql`) fires
`AFTER INSERT` on `swipes`: when a `right` swipe lands, it checks whether the *other* partner
already right-swiped the same title in the same session+round, and if so inserts into
`matches` and flips `sessions.status` to `matched` — all inside the same transaction. Both
clients subscribe to Postgres changes on `matches` (filtered by `session_id`) via Supabase
Realtime, so the match reveal fires the instant it happens, independent of whether either
partner has finished their deck. Round-advance/finalize (client→server) uses an *optimistic
claim* pattern (`UPDATE ... WHERE status = 'swiping' AND round = N`) so if both partners'
clients detect round-completion simultaneously, only one successfully kicks off the next
pool generation — the loser's request just returns current state, harmless.

### Data model (six tables, see `supabase/schema.sql` for the authoritative version)
`sessions` (status/round/device_a_id/device_b_id/pair_key/final_picks) → `preferences` (one
row per partner per session) → `pool_titles` (round-scoped candidate pool, enriched with
TMDB+RapidAPI data) → `swipes` (one row per partner per title per round) → `matches`
(inserted by the trigger) → `ratings` (post-watch, keyed to session+title).

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
  subscribe on RapidAPI's marketplace separately from generating the key — free Basic tier;
  watch for rate-limit exhaustion since pool generation burns ~30 RapidAPI calls per round)
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
