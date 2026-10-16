---
name: venom-delivery-gate
description: Prevent rework by enforcing acceptance criteria, scoped implementation, regression checks, mobile/UX review, security risk triage, evidence-based QA and human-approved release. Use before declaring work done, shipping, handing over a website, opening or merging a PR, or responding to recurring revision cycles.
---

# VENOM CODE — Zero-Rework Delivery Gate

Goal: ship verifiable outcomes. "Zero rework" is a target, not a guarantee.

## Before making changes (Definition of Ready)
1. Clarify desired outcome, target audience, exact acceptance tests, expected UI states, affected pages/devices, constraints and existing components. Avoid implementing an assumption as fact.
2. Inventory source: branch, dependencies, API routes, state, tests, designs and past requirements. Capture current baseline before editing (screenshots only when browser available).
3. Make a scoped plan with risk assessment and rollback path. New functionality needs tests; bugfix needs reproducible failing regression first. No opportunistic redesign.

## Before handoff (Definition of Done)
- **Functional:** Acceptance scenarios demonstrated; check empty/loading/error/success states and form validation.
- **Visual:** Compare desktop and mobile against brief; test menus, spacing, CTAs, typography, motion reduced-preference, accessibility.
- **Technical:** Check build, typing, linter and relevant existing tests if commands exist. Include exact output and pass/fail. Do not invent checks.
- **Security:** Select relevant `code-review-security`, `secrets-scan`, `sca-audit` and `venom-pentest` per risk. Resolve high-severity regressions before approval.
- **Commercial:** Humanizer for published copy; preserve real names, legal claims, testimonials, prices, deadlines.
- **Delivery:** Review diff, avoid unrelated files, verify preview, document rollback. Never auto-merge to main or publish without approval.

## Handoff contract
`Goal | Changes | Acceptance criteria met | Tests actually run | Screens validated | Security findings | Risks / NOT TESTED | Preview | Decision needed`.
Any NOT TESTED must be visible; a passing build is not a passing user flow.
