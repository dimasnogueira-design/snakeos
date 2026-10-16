## VENOM — Definition of Done / Release Review

- [ ] Acceptance criteria are explicit and verified with evidence, not assumptions
- [ ] Scope reviewed and unrelated files unchanged
- [ ] Desktop + mobile layout and keyboard accessibility checked (where applicable)
- [ ] Forms/CTAs and error/empty/loading states validated
- [ ] Existing tests/lint/build run where scripts exist; output linked or documented
- [ ] Security review completed for affected surface (OWASP web/API/auth), including credentials and dependencies where applicable
- [ ] CodeQL/security findings triaged (if CodeQL enabled)
- [ ] Known limitations, NOT TESTED areas, and rollback documented
- [ ] Human approved before merging to main or deploying to production

**Pentest scope:** Passive code audit by default. No live active penetration tests without explicit authorized scope.
