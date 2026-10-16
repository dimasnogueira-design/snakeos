---
name: verification
description: Verify complete web product flows end to end, from browser and client input to API, database, response and UI. Use when asked to test a feature, investigate nearly-working flows, check forms or confirm launch readiness.
---
# VENOM Full-Flow Verification

Use this skill when checking whether functionality actually works, beyond a screenshot or successful build.

1. Describe the user story: action -> UI -> network -> API -> data/external service -> response -> UI. List expected outputs and failure paths.
2. Inspect affected routes/components, package scripts, API contracts and environment *names*. Never print secret values.
3. Run available static gates (`npm run lint`, `npx tsc --noEmit`, `npm run test:gate1-core`), report true outputs rather than inferring.
4. Test the flow in preview/local context when tools exist: actions, keyboard, mobile widths, errors, states, success paths; use `agent-browser` if available.
5. For form/SNAKE/lead routes, check validation, status codes, origin handling, rate limiting and persistence; avoid posting real customer data.
6. Capture findings as **PASS / FAIL / NOT TESTED**, each with observable evidence and reproducible steps.
7. Separate visual, API, data and production verification. Never say production is confirmed based only on a local build.

If browser, runtime or credentials are unavailable, state NOT TESTED and request the missing execution environment. Never fabricate screenshots or CI results.
