---
name: venom-skill-router
description: Automatically route VENOM CODE tasks to the right installed specialist skills for development, UI, debugging, QA, deployments and customer-facing text.
---

# VENOM Skill Router

Start by classifying the task and reading the applicable `SKILL.md` files under `.agents/skills/`. A skill is reusable guidance; it is not a running daemon. Load only relevant specialties.

| Task signal | Skills |
| --- | --- |
| React, Next.js, TSX performance | `vercel-react-best-practices` |
| UI, accessibility, responsive, visual QA | `web-design-guidelines` |
| Bugs, failed builds, unexpected behavior | `systematic-debugging` + `test-driven-development` |
| Multi-step implementation | `writing-plans` + `test-driven-development` |
| Test customer journey / endpoints | `verification` and `agent-browser` if the executable is available |
| Browser interactions / screenshots | `agent-browser` |
| Review and pre-merge verification | `requesting-code-review` + `verification` |
| Vercel deploy, GitHub Actions, rollback | `deployments-ci-cd` |
| Natural commercial copy, proposals, messages | `humanizer`; always preserve truth and attribution |

## Guardrails
1. User intent, privacy, factual accuracy, contracts and system security outrank stylistic suggestions.
2. Diagnose before fixing; plan before complex change; add tests for code changes; verify before claiming success.
3. No automatic push to production, migrations, payments, customer communication, or merge without explicit approval.
4. Never invent metrics, testimonials, screenshots, QA results or references.
5. Humanizer changes prose, not code, customer records or contract clauses.
6. STAY12 is paused and excluded unless explicitly reactivated.

## Handoff
Report selected skills, changes made, evidence of checks actually run, checks not performed and approvals still required.

## Mandatory security + anti-rework gates (VENOM October 2026)

- **New feature, bugfix, redesign or delivery** -> invoke `venom-delivery-gate` before claiming complete, with scoped acceptance criteria, QA evidence and approved handoff.
- **Pentest request, web vulnerability, pre-launch audit, authentication risk** -> invoke `venom-pentest` and select `web-security-review`, `api-security-review`, and/or `code-review-security`.
- **Credential exposure or credential-looking changes** -> `secrets-scan`, with secret rotation guidance; never display secret values.
- **Dependency manifest/lockfile changes, vulnerable dependency** -> `sca-audit`; use real scanner output, not made-up CVE numbers.
- **Security-sensitive code (auth, sessions, data access, API, uploads, prompt injection)** -> `code-review-security` + relevant checks before approval.
- **Before PR approval or client handoff** -> `venom-delivery-gate` + relevant security skills; require actual reproducible test evidence.

**Scope**: All auto-audits default to read-only source/config review. Network probes, even passive crawling, need confirmed ownership and explicit scoped authorization for the target. Never launch an active pentest automatically, target a third-party domain, perform destructive tests, or claim that a security assessment ran when only the skill was installed.

**Security scans**: CodeQL CI may analyze source code on PRs where enabled. CodeQL is SAST and does **not** constitute a dynamic penetration test. ZAP Baseline is documented for manual, explicitly authorized staging checks only.
