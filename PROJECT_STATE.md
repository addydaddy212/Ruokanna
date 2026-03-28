# PROJECT_STATE

## Product summary
- Ruokanna is a private AI-assisted meal planning and cooking app.
- Core loop: save recipes, capture fridge state, set macro/health guardrails, plan the week, cook step-by-step, then review the week.
- The README is outdated. The code clearly targets "structured meal intelligence for real weekly cooking," not just a generic recipe app.

## Problem solved
- Reduces weeknight decision fatigue.
- Connects recipes to real fridge inventory, time budget, macro goals, and dietary/health constraints.
- Keeps planning, cooking, and weekly review in one product instead of splitting them across separate tools.

## Current implementation state
- Authenticated React SPA with a working multi-page product surface.
- Client talks directly to Supabase for auth and CRUD.
- Express server is thin and focused on AI-backed features: recipe extraction/generation, fridge scan, recommendations, chat, and debrief.
- Important persistence split: `goal`/`calorie_target` live in Supabase, but many profile fields plus meal status/leftovers currently live in localStorage sidecars.
- Historical residue still exists: package name, QA scripts, and some messages still use the old name `mise`.

## Tech stack
- React 18 + Vite + `react-router-dom`
- Express on port `3001`
- Supabase auth + Postgres
- Optional AI providers: Groq, Gemini, Jina Reader
- Tailwind is installed, but most UI is custom inline styling plus shared theme tokens
- `npm run build` currently passes

## Main routes/pages/features
- `/auth`: email/password auth and Google OAuth
- `/`: weekly dashboard with planner, auto-plan, swap, leftovers, grocery modal, and "Just Tell Me"
- `/recipes`: filterable recipe library ranked against fridge overlap
- `/recipes/add`: URL import, YouTube transcript import, AI generation, manual entry
- `/recipes/:id`: recipe detail, source confidence, provenance, fit analysis
- `/cook/:id`: step-by-step cook mode with timers and jump-to-chat context
- `/macros`: macro goal selection, health/diet filters, weekly macro rollup
- `/fridge`: manual fridge list, image scan, cook-now matches
- `/debrief`: weekly adherence summary plus AI suggestions
- `/chat`: contextual assistant grounded in saved recipes, fridge, and profile

## What is already working
- Auth worked in the 2026-03-23 QA rerun after the Supabase trigger fix.
- Manual recipe creation works end-to-end.
- Dashboard meal add, swap, leftovers toggle, and refresh persistence work.
- Cook Mode basic step progression works.
- Fridge manual add/remove and recipe matching work; image scan has a dev fallback path.
- Macro goal switching and persistence work.
- Chat returns responses and preserves session history within the session.
- Debrief page shell and AI/fallback summary flow exist.

## What is weak or unfinished
- Repo documentation was extremely thin before these root context files.
- No automated `test` or `lint` npm scripts exist.
- QA harness is custom and Windows/Edge-oriented.
- `DashboardPage.jsx` is large and central; component primitives are duplicated across `common/` and `shared/`.
- Multi-device persistence is incomplete because profile filters and meal meta are partly local-only.
- Fridge expiry support is half-built: schema and UI fields do not line up.
- Instagram extraction is intentionally unsupported.
- Some high-value flows still need tighter QA: URL/YouTube import, `Just Tell Me`, multi-step Cook Mode, and the debrief AI block.
- Ports and naming are inconsistent: Vite is configured for `5174`, while older QA/docs/settings still point at `5173` and `mise`.

## Current product stage
- Functional local MVP / private alpha.
- The product spine is real and usable, but setup truth, persistence, QA coverage, and codebase coherence still need work before this feels durable.
