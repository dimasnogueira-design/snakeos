# VENOM CODE — GitHub Copilot

Load repository rules in `AGENTS.md`. Auto-classify the task using `.agents/skills/venom-skill-router/SKILL.md` and open the matching `.agents/skills/<name>/SKILL.md` files (never all by default).

Use `web-design-guidelines` for UX/mobile; `systematic-debugging` for broken behavior; `test-driven-development` for bugfix/feature; `verification` for end-to-end QA; `agent-browser` when available; `requesting-code-review` before handoff; `deployments-ci-cd` for release changes; `humanizer` only for accurate customer-facing prose. Use `vercel-react-best-practices` ONLY for projects actually containing React/Next.js.

Never deploy or merge production automatically; do not use secrets or paid tools without approval. Tests are verified only when they were actually executed.
