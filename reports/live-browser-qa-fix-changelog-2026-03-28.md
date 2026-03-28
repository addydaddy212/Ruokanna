# Live QA Fix Changelog

Date: 2026-03-28
Scope: Planner stability, recipe save flow hardening, Cook Mode navigation fallback, and live browser QA reliability improvements.

## Final Outcome
- `npm run build` passed after the implementation pass.
- Final live browser QA result: `58 pass / 0 warn / 0 fail`
- Raw QA artifact: `/tmp/ruokanna-live-qa/report.json`

## Fixed Behaviors

### Weekly Dashboard planner
- Meal add, clear, leftovers, cooked, skipped, and swap actions now use a deterministic mutation flow.
- Planner actions are blocked while a slot save or auto-plan refresh is in flight, preventing overlapping writes.
- Auto-plan now settles more reliably before downstream UI actions run.
- Dashboard meal cards expose stable slot-scoped QA markers for title, empty state, and slot state.
- Grocery list checks now operate against settled planner state instead of transient refresh timing.

### Swap and meal selection
- Meal picker and swap flows now wait for the refreshed dashboard state before the modal closes.
- QA now verifies the exact slot card that changed instead of relying on whole-page text snapshots.
- Swap flow assertions now tolerate the intended deterministic fallback behavior instead of timing noise.

### Recipe save flow
- Recipe creation no longer treats the extended-schema insert failure as the normal path on every save.
- The client now caches whether the current Supabase schema supports the extended insert shape.
- AI-generated recipe save confirmation now waits for the recipes page to settle before asserting the new card.

### Dashboard data hydration
- Meal plan recipe hydration now includes nested ingredients and steps, which fixed grocery derivation from planned meals.
- Auto-plan fallback now fills missing AI-returned slots with valid fallback assignments instead of leaving partial days empty.

### Cook Mode navigation
- Cook Mode back navigation now uses a deterministic in-app fallback chain:
  - return to the originating recipe detail page when available
  - otherwise open `/recipes/:id` for the current recipe
  - otherwise fall back to `/recipes`
- Recipe detail now passes the source route into Cook Mode so the back action can resolve cleanly.

### Macro and QA observability
- Dashboard and macros pages now expose stable hidden QA markers for active day, planner idle state, calories, and macro targets.
- Macro goal checks and planner assertions now read those explicit markers instead of parsing unstable visual text.

## Verification Notes
- The planner cluster that originally produced failures and flaky warnings now passes end to end.
- AI-backed flows used in the live pass remained healthy during the rerun.
- No invalid API key issue appeared during the final verification run.

