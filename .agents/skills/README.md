# VENOM CODE — 11 Agent Skills

These project-scoped skills are in `.agents/skills/` with YAML frontmatter and `SKILL.md`. Compatible coding agents can discover their descriptions, then load them according to the task. Guidance for automatic selection is in `AGENTS.md`, `.github/copilot-instructions.md`, and `venom-skill-router/SKILL.md`.

**A skill is guidance, not a running background service**. Browser tooling, authentication, API connections and CI execution are separate.

Upstream information and licenses are in `THIRD_PARTY_NOTICES.md` and `_licenses/`. Changes require code review; production release is never assumed.

## Security & delivery extension — 2026-10-16

**Updated pack: 18 skills total**, counting the original 11 skills plus:
- `venom-pentest`: non-destructive security assessment orchestrator with strict scope and authorization
- `venom-delivery-gate`: Definition of Ready / Done, QA evidence, responsive and regression review
- `web-security-review`, `api-security-review`, `code-review-security`: OWASP-based audit procedures (full plays included)
- `secrets-scan`, `sca-audit`: credential and dependency security guidance

Routing is defined in `AGENTS.md` and `venom-skill-router/SKILL.md`. Source attribution in `SECURITY_SOURCES.md`.
CodeQL static analysis runs on public repository PRs **where installed**; the private RebelShop repository is excluded. Static analysis is not penetration testing, and no live tests run without explicit authorization.
