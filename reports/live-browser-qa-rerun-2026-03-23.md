# Live Browser QA Rerun

Date: 2026-03-23
Target: `http://localhost:5173`
Runner: [live-browser-qa-runner.cjs](/home/aditya/mise/scripts/qa/live-browser-qa-runner.cjs)
Fixture: [qa-recipe.html](/home/aditya/mise/public/qa-recipe.html)
Raw artifacts: `C:\Temp\mise-live-qa\report.json`, `C:\Temp\mise-live-qa\screenshots`

## Confirmed Working
- Auth redirect, signup, signin, refresh persistence, and signout all worked in the live rerun. Auth client wiring is in [useAuth.jsx](/home/aditya/mise/src/hooks/useAuth.jsx#L21) and the private route guard is in [App.jsx](/home/aditya/mise/src/App.jsx#L15).
- Manual recipe creation worked end-to-end four times from the Add Recipe page and saved into the recipes list. Page flow is in [AddRecipePage.jsx](/home/aditya/mise/src/pages/AddRecipePage.jsx#L141).
- Dashboard meal add worked from the recipe picker, swap applied a replacement, leftovers toggle was exercised, and the plan persisted after refresh. Dashboard flow is in [DashboardPage.jsx](/home/aditya/mise/src/pages/DashboardPage.jsx#L203) and [DashboardPage.jsx](/home/aditya/mise/src/pages/DashboardPage.jsx#L760).
- Cook Mode opened from a dashboard meal card and showed a single-step view with progress text. Cook screen is in [CookModePage.jsx](/home/aditya/mise/src/pages/CookModePage.jsx#L59).
- Fridge manual add, individual remove, Cook Now tab access, and match percentages worked live. Fridge flow is in [FridgePage.jsx](/home/aditya/mise/src/pages/FridgePage.jsx#L43).
- Macro goal switching to Cut and Bulk worked and the selected goal persisted after refresh. Macro flow is in [MacrosPage.jsx](/home/aditya/mise/src/pages/MacrosPage.jsx#L85).
- Chat loaded with suggestion chips, accepted a message, returned a response, and preserved history across navigation. Chat flow is in [ChatPage.jsx](/home/aditya/mise/src/pages/ChatPage.jsx#L96).
- Debrief page navigation worked and the page rendered its summary shell. Debrief flow is in [DebriefPage.jsx](/home/aditya/mise/src/pages/DebriefPage.jsx#L15).
- Mobile viewport check showed the bottom navigation shell. Responsive nav is in [Layout.jsx](/home/aditya/mise/src/components/Layout.jsx#L35).

## Still Unclear Or Needing Follow-Up
- URL import and AI generate both visibly reached preview states in the browser, but the current harness preview detection is still too conservative, so those checks remained warnings instead of clean passes.
- YouTube transcript detection did not clearly flip the CTA during the rerun, so that path still needs direct manual verification.
- `Just Tell Me` did not clearly surface a recommendation modal in the rerun.
- Cook Mode completion and back-navigation need a tighter scripted pass on a multi-step recipe with timers.
- Weekly averages on the Macro page and AI suggestions on the Debrief page need a better read than the current top-of-page text capture.

## Likely Next Step
- Tighten the modal and picker selectors in [live-browser-qa-runner.cjs](/home/aditya/mise/scripts/qa/live-browser-qa-runner.cjs) and rerun a focused pass for `Just Tell Me`, URL/AI save confirmation, YouTube transcript handling, multi-step Cook Mode, and the debrief AI block.
