# VENOM CODE — 11 Agent Skills

These project-scoped skills are in `.agents/skills/` with YAML frontmatter and `SKILL.md`. Compatible coding agents can discover their descriptions, then load them according to the task. Guidance for automatic selection is in `AGENTS.md`, `.github/copilot-instructions.md`, and `venom-skill-router/SKILL.md`.

**A skill is guidance, not a running background service**. Browser tooling, authentication, API connections and CI execution are separate.

Upstream information and licenses are in `THIRD_PARTY_NOTICES.md` and `_licenses/`. Changes require code review; production release is never assumed.
