# CURRENT_BACKLOG

## Now
- Make repo truth obvious: keep these root docs current and improve README/onboarding around env, Supabase, and ports.
- Resolve setup drift: old `mise` naming, old file paths, and the `5173` vs `5174` mismatch.
- Decide whether profile filters/targets and meal status/leftovers should remain local-only or move into Supabase-backed persistence.
- Tighten QA on the highest-risk user flows: URL import, YouTube transcript import, `Just Tell Me`, swap flow, multi-step Cook Mode, and debrief AI output.
- Verify auth + schema bootstrap from a clean Supabase project and reduce manual footguns.

## Next
- Break up `src/pages/DashboardPage.jsx` and consolidate duplicated `common/` vs `shared/` UI primitives.
- Add recipe editing/update capability; current recipe management is mostly create/view/delete.
- Either wire up `meal_events`, `recipe_matches`, and `recipe_extractions` for real product value or clearly de-scope them.
- Improve grocery list quality with better quantities, categories, and leftover awareness.
- Tighten provenance/confidence language so users understand what is estimated versus manually entered.

## Later
- Deepen fridge inventory: quantities, expiry, source tracking, and prioritization.
- Strengthen ingestion and nutrition estimation beyond heuristic/dev fallback behavior.
- Improve post-cook follow-through if it helps weekly planning, not just one-off delight.
- Make cross-device continuity stronger once persistence is no longer split.

## Explicitly deferred / out of scope
- Instagram recipe extraction without a reliable caption/transcript source.
- Turning Ruokanna into a generic social recipe discovery product.
- Presenting macro/cost estimates as if they are verified nutrition labels or live grocery prices.

## Known bugs or rough edges
- Vite dev config uses port `5174`, but QA scripts, older reports, and local settings still assume `5173`.
- Package name and multiple scripts/messages still say `mise`.
- `FridgePage` looks for `expiry_date`, while the schema upgrade adds `expires_at`; expiring-soon behavior is effectively unfinished.
- `useRecipes` still points Supabase migration errors at old `/home/aditya/mise/...` paths.
- Theme/component drift exists: duplicated component folders plus missing token references such as `THEME.textSoft` and `THEME.shadow`.
- There is no built-in `npm test` or `npm run lint`; `npm run build` is the only ready-made verification command.
