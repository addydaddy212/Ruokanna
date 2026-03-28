# AGENTS.md

## Repo guidance for future Codex work

### Start here
- Read `PROJECT_STATE.md`, `UI_DOCTRINE.md`, `CURRENT_BACKLOG.md`, and `PROMPT_CONTEXT.md` before making product decisions.
- Trust those files and the implementation over `README.md` if they conflict.
- Preserve unrelated user edits; this repo may already be in a dirty worktree.

### What this product is trying to become
- Ruokanna is a meal-planning and cooking operating surface for one person's real week.
- The center of gravity is the weekly dashboard plus the supporting recipe/fridge/macro/debrief loop.
- AI is an assistant layer around planning, extraction, scanning, explanation, and debriefing, not the whole product.

### Repo shape
- `src/`: React SPA
- `server/`: Express endpoints for AI/extraction/planning/chat/debrief
- `supabase_schema.sql`, `supabase_schema_ruokanna_upgrade.sql`, `supabase_auth_fix.sql`: Supabase bootstrap/repair scripts
- `scripts/qa/`: custom live-browser QA harness
- `reports/`: previous QA findings

### Commands
- Install: `npm install`
- Dev: `npm run dev`
- Client dev server: Vite on `5174` in current config
- Server dev process: `node --watch server/index.js` on `3001`
- Build: `npm run build`
- Preview build: `npm run preview`
- QA harness: `./scripts/qa/run-live-browser-qa.sh`

### Workflow
- Before larger changes, inspect the affected route plus `src/hooks/useRecipes.js` and any matching server route.
- Prefer understanding the data flow first: client-side Supabase CRUD versus server-side AI helper endpoint.
- After meaningful code changes, run at least `npm run build`.
- For auth/planner/fridge/cook/chat/debrief changes, do a route-level smoke pass when feasible.
- If docs and code disagree, document the disagreement instead of silently choosing one.

### Guardrails
- Do not flatten Ruokanna into a generic recipe CRUD app.
- Preserve the dark tactical UI and planner-first information hierarchy.
- Preserve route names and product naming unless there is a strong reason to change them.
- Do not remove AI/dev fallback behavior casually; local QA depends on it.
- Keep schema compatibility in mind. If you change data contracts, update both client/server assumptions and the SQL scripts when appropriate.
- Distinguish implemented behavior from planned or inferred behavior.

### Testing expectations
- Minimum verification: `npm run build`
- There is no first-class `npm test` or `npm run lint` yet.
- QA harness is environment-specific: it is built around WSL/Windows, PowerShell, and Edge CDP.
- QA scripts and some reports still use legacy `MISE_*` env vars and older `5173` assumptions; treat them carefully.

### Product-awareness notes
- Supabase is the source of truth for auth, recipes, ingredients, steps, meal plan rows, and fridge rows.
- Express is only for AI-backed endpoints: `/api/recipes/*`, `/api/fridge/scan`, `/api/planner/*`, `/api/chat`, `/api/debrief`.
- Profile guardrails and meal meta are currently split between Supabase and localStorage.
- Historical residue matters: package name is still `mise`, some error paths still reference `/home/aditya/mise/...`, and some scripts/settings still assume port `5173`.

### What should be preserved vs changed carefully
- Preserve: planner-first product direction, dark tactical UI, recommendation/provenance framing, and the weekly loop.
- Change carefully: persistence model, route taxonomy, schema contracts, QA harness assumptions, and naming cleanup that may touch many files.
