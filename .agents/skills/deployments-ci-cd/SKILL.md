---
name: deployments-ci-cd
description: Plan and verify safe Vercel and GitHub CI/CD operations. Use for deploys, preview environments, build failures, domains, release checks, promotions and rollback.
---
# VENOM Deployments & CI/CD

Determine exact GitHub repository, Vercel team/project, branch and target environment before any write.
- For code changes: use branch -> pull request -> CI -> preview -> review -> explicitly authorized merge/release.
- Use Vercel Git integration preview deployments for PRs; do not initiate production releases without explicit approval.
- Diagnose failed builds by reading logs and checking package scripts, lockfile, Node version and *presence* of required environment variables.
- Never print secret values, change production variables or bypass protection.
- After deploy, inspect actual status, build logs, runtime errors and basic user paths; report what was verified.
- On regression, recommend rollback only with verified target deployment and user approval.
- Check GitHub Actions results before recommending merge.

The repository workflow is a **quality gate**, not an autonomous deployment mechanism. It must not use production secrets on untrusted pull requests.
