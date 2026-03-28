# Live Browser QA

Date: 2026-03-28
Target: `http://localhost:5175`
Server: `http://localhost:3001`
Build check: `npm run build` passed
Runner: [live-browser-qa-runner.cjs](/home/aditya/Ruokanna/scripts/qa/live-browser-qa-runner.cjs)
Raw JSON artifact: `/tmp/ruokanna-live-qa/report.json`
Screenshots: `/tmp/ruokanna-live-qa/screenshots`

## Environment notes
- Vite did not bind to the expected `5174`; that port was already occupied, so the live run used `5175`.
- The scripted browser pass ran against a local Chromium CDP session and completed end-to-end.
- No invalid API key or provider-auth failure surfaced during this run. The AI-backed endpoints exercised by the runner returned `200`.
- Fridge scan completed through the app's local dev fallback path for the QA fixture image.

## Result snapshot
- Checks: 60 total
- Passed: 50
- Warned: 9
- Failed: 1

## Confirmed working
- Auth redirect, disposable signup, refresh persistence, and signout worked.
- Manual recipe creation worked for five seeded recipes.
- URL extraction reached preview and saved successfully from the local fixture page.
- AI recipe generation reached preview successfully.
- YouTube URL detection switched to transcript mode and reached a preview.
- Dashboard loaded, day switching worked, `Just Tell Me` opened a recommendation, and `Cook tonight` opened Cook Mode.
- Leftovers toggle worked.
- Cook Mode step progression, timer start/pause, completion state, and recipe-detail entry all worked.
- Fridge upload, manual add/remove, clear-all, Cook Now tab, and fridge match percentages worked.
- Macro goal switching, per-day breakdown, and goal persistence worked.
- Chat suggestions, send, response rendering, and chat-history persistence worked.
- Debrief page loaded and rendered its summary/suggestions block.
- Mobile bottom navigation shell rendered.

## Findings to investigate

### 1. Dashboard meal add / planner confirmation is unreliable
- Status: `fail`
- Check id: `dashboard.add_meal`
- Symptom: after clearing breakfast and selecting a replacement from the picker, the run could not clearly confirm that the chosen recipe filled the slot.
- Related signals:
  - `dashboard.macros_after_add` warned because calories did not clearly increase after the add.
  - `dashboard.day_filled` warned because the active day did not clearly show all four filled slots after refill.
  - `dashboard.refresh_persist` warned because the planned meals were not clearly visible after refresh.
- Likely area: dashboard meal-slot refresh/rendering or picker-to-slot update flow.

### 2. Auto-plan and grocery-list validation remain shaky
- Status: `warn`
- Check ids: `dashboard.auto_plan`, `dashboard.grocery_list`
- Symptom: `/api/recipes/autoplan` returned `200`, but the run could not clearly verify that all seven days ended up fully populated. The grocery modal also opened, but the runner could not clearly confirm grocery items.
- Likely area: dashboard post-autoplan UI refresh, day-by-day hydration, or grocery-list derivation from plan state.

### 3. Swap flow is not clearly settling
- Status: `warn`
- Check ids: `dashboard.swap_modal`, `dashboard.swap_apply`
- Symptom: the swap modal opened, but the runner could not clearly confirm the expected option set or that applying a swap changed the visible meal.
- Likely area: swap modal option rendering or visible planner refresh after swap.

### 4. AI-generated recipe save needs confirmation
- Status: `warn`
- Check id: `recipe.ai.save`
- Symptom: AI generation produced a valid preview, but the return to the recipe list did not clearly confirm the saved entry.
- Likely area: post-save navigation/loading state on the recipes list after saving generated recipes.

### 5. Cook Mode back-navigation from recipe detail is inconsistent
- Status: `warn`
- Check id: `cook.page_back`
- Symptom: entering Cook Mode from a recipe detail page worked, but the Cook Mode back button did not clearly return to that detail page.
- Likely area: `navigate(-1)` history behavior in [CookModePage.jsx](/home/aditya/Ruokanna/src/pages/CookModePage.jsx).

## Technical notes from the trace
- Every recipe save succeeded from the user's perspective, but the network trace showed a repeated `400` followed by a successful `201` on recipe creation. That matches the fallback logic in [useRecipes.js](/home/aditya/Ruokanna/src/hooks/useRecipes.js) and suggests the live Supabase schema is still missing some of the newer recipe columns, or the schema cache is stale.
- The browser console showed repeated React Router v7 future-flag warnings during navigation. These are noisy but not blocking.
- Vite also emitted deprecation warnings during startup about the React Babel plugin / `esbuild` options. These are not part of the product QA failures, but they are current maintenance drift.

## Suggested next fix order
1. Dashboard add/swap/refresh persistence cluster
2. Auto-plan to grocery-list visibility chain
3. AI-generated recipe save confirmation
4. Cook Mode back-navigation behavior
5. Schema drift causing recipe-create fallback retries
