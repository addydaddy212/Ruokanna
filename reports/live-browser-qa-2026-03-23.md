# Live Browser QA Report

Date: 2026-03-23
Target: `http://localhost:5173`
Method: live browser automation against a running local app using Edge CDP
Artifacts:
- Raw report: `C:\Temp\mise-live-qa\report.json`
- Screenshots: `C:\Temp\mise-live-qa\screenshots\auth-landing.png`, `C:\Temp\mise-live-qa\screenshots\auth-after-signup.png`, `C:\Temp\mise-live-qa\screenshots\auth-after-signin-attempt.png`

### ✅ FULLY WORKING
- Logged-out navigation to `/` redirected to `/auth` in a live browser run. Route guard is implemented in [src/App.jsx](/home/aditya/mise/src/App.jsx#L15).

### ⚠️ PARTIALLY WORKING
- The auth screen loads and the Sign In / Sign Up UI is interactive, but the end-to-end account creation flow does not complete because the signup request fails before a session can be established. Form handling is in [src/pages/AuthPage.jsx](/home/aditya/mise/src/pages/AuthPage.jsx#L27) and Supabase auth wiring is in [src/hooks/useAuth.jsx](/home/aditya/mise/src/hooks/useAuth.jsx#L21).
- Email confirmation behavior could not be verified live because signup failed before the app reached the post-signup confirmation state. The current UI expects a confirmation step in [src/pages/AuthPage.jsx](/home/aditya/mise/src/pages/AuthPage.jsx#L56).

### ❌ BROKEN
- Sign up with email/password does not create an account. The live browser run captured a `POST` to Supabase `.../auth/v1/signup` returning `500`, and the UI displayed `Database error creating anonymous user`. Relevant client code is in [src/pages/AuthPage.jsx](/home/aditya/mise/src/pages/AuthPage.jsx#L40) and [src/hooks/useAuth.jsx](/home/aditya/mise/src/hooks/useAuth.jsx#L21). The expected profile trigger path is defined in [supabase_schema.sql](/home/aditya/mise/supabase_schema.sql#L15).
- Sign in after signup does not reach the private app because the signup flow never produced a valid account/session. The browser remained on `/auth` after the sign-in attempt. The sign-in call is wired in [src/hooks/useAuth.jsx](/home/aditya/mise/src/hooks/useAuth.jsx#L24).
- All authenticated user flows were blocked live by the auth failure, including Weekly Dashboard, Fridge Scanner, Macro Autopilot, Just Tell Me, Cook Mode, Swap / Shuffle, Leftover Tracker, Weekly Debrief, Recipe Addition, Meal Planning, Fridge-to-Dashboard connection, Auto-plan, and Chat. These routes are all protected in [src/App.jsx](/home/aditya/mise/src/App.jsx#L29).

### 🔲 MISSING FROM SPEC
- No feature is marked as definitively missing from this live run alone because the browser never reached the authenticated application surface. A missing-features audit for those areas would require a working login or a separate static code audit.

### 📋 PRIORITY FIX LIST
1. Fix Supabase signup so a dev user can be created successfully. The first place to inspect is the auth-user-to-profile creation path in [supabase_schema.sql](/home/aditya/mise/supabase_schema.sql#L15).
2. Re-run the live browser sweep immediately after auth is fixed, because nearly the entire requested checklist sits behind the private route gate in [src/App.jsx](/home/aditya/mise/src/App.jsx#L15).
3. If email confirmation is required in this Supabase project, keep the current confirmation UX but provide a working dev mailbox flow or disable confirmation for local QA. The UI currently assumes this step in [src/pages/AuthPage.jsx](/home/aditya/mise/src/pages/AuthPage.jsx#L56).

Score: 1/98 checklist items implemented correctly in live browser QA.
