# VENOM CODE — Repository Agent Rules

**Project:** snakeos

**Technical scope:** SNAKE OS é o agente de WhatsApp da VENOM CODE, com Node.js, TypeScript, Express, banco e testes Vitest. Trata dados de contatos e mensagens.

## Auto-route applicable skills
At the beginning of each compatible AI coding task, inspect `.agents/skills/venom-skill-router/SKILL.md` and select relevant skill files from `.agents/skills/<skill-name>/SKILL.md`. Do not load every skill on every request.

| When working on | Activate |
| --- | --- |
| HTML/CSS/mobile/accessibility/design | `web-design-guidelines` |
| React, Next.js, TSX **when actually present** | `vercel-react-best-practices` |
| Debug, build error, regression | `systematic-debugging`, `test-driven-development` |
| Complex implementation, multi-step refactor | `writing-plans`, `test-driven-development` |
| Browser/screenshots, interactive QA | `agent-browser` if executable is available, `verification` |
| Full user story, API or functional verification | `verification` |
| Code review and release readiness | `requesting-code-review` |
| Vercel/GitHub CI/CD and deployments | `deployments-ci-cd` |
| Human-readable customer/marketing copy | `humanizer`; preserve every verifiable fact |

## Project-specific safety and quality
- Para código Node/TS, executar npm run typecheck, npm test e npm run build quando o ambiente permitir. Não disparar mensagens reais, alterar consentimento, migrar o banco ou conectar WhatsApp sem autorização explícita.
- Distinguish client facts from design concept/mockups; no fabricated testimonials, metrics, testimonials, claims or credentials.
- Do not mix information from different customer repositories. Never expose secrets, customer contacts or API keys.
- Inspect existing code structure and tooling; do not introduce Next.js, npm, or dependency installation just to make a skill runnable.
- Plan changes on a feature branch; no autonomous merge to `main`, production deployment, payments, customer messaging, destructive changes or migrations without approval.
- Diagnose root cause before fixes; add tests when a behavior changes; verify before claiming completion.
- Browser skill describes procedures but does not itself install a browser or grant access to protected sites.
- STAY12 is paused and not part of the active VENOM rollout.

## Completion report
List the skills selected, actual changed files, verified test outputs, what is untested, and whether human approval is required.
