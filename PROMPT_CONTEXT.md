# PROMPT_CONTEXT

Ruokanna is a private AI-assisted meal planning and cooking app, not just a recipe library. The core workflow is: save/import/generate recipes, track fridge ingredients, set macro and health guardrails, plan the week on the dashboard, cook step-by-step, then review the week in debrief.

Current reality:
- Trust the code and these root docs over `README.md`; the README is too thin.
- Frontend is a React/Vite SPA. Supabase handles auth and most persisted app data.
- Express only handles AI-backed flows: recipe extraction/generation, fridge scan, planner recommend/swap, chat, and weekly debrief.
- The main product surface already exists across Dashboard, Recipes, Add Recipe, Recipe Detail, Cook Mode, Macros, Fridge, Debrief, and Chat.
- The product identity is planner-first, dark, tactical, and decision-support oriented.

Important constraints:
- Do not casually turn this into a generic recipe feed, calorie tracker, or light-theme CRUD app.
- Preserve the current route structure and product language (`Macro Autopilot`, `Just Tell Me`, `Weekly Debrief`, `Fridge`, `AI Assistant`).
- Be explicit about what is implemented versus what is only implied by schema or naming.
- Call out repo/doc conflicts when they matter.

Current technical caveats:
- Profile filters/targets and meal status/leftovers are partly stored in localStorage, so persistence is split.
- Historical `mise` residue still exists in package name, QA scripts, env var names, and some paths/messages.
- Vite is configured for `5174`, but older QA/docs/settings still point at `5173`.
- Build passes with `npm run build`, but there is no first-class test/lint script yet.

Near-term priorities:
- Improve onboarding/setup truth.
- Resolve persistence and naming/port drift.
- Tighten QA on the most important user flows.
- Reduce dashboard/component/theming drift without losing the existing product feel.
