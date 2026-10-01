# iSaudi.ai agent instructions

## Project identity

- Workspace: `C:\isaudi-ai`
- Repository: `deadevil2002/isaudi`
- Working branch: `new-ui-migration`
- Cloudflare account: `e8ae8afc6a6708283d6b0b4534f7c91f`
- Wrangler profile: `isaudi`
- Production: Worker `isaudi`; D1 `isaudi-db` (`9e19c212-0118-4660-aaeb-e46cc7f4470e`); domain `isaudi.ai`
- Staging: Worker `isaudi-staging`; D1 `isaudi-staging-db` (`48ad8f80-6aae-4147-84e5-9f88161401eb`); URL `https://isaudi-staging.isaudi-official.workers.dev`

## Permanent rules

1. Never use another Cloudflare account or Wrangler profile. Do not fall back to a default profile.
2. Before any remote Cloudflare mutation, run the existing iSaudi preflight for the target environment and stop on any identity or resource mismatch.
3. Touch production only when the user explicitly authorizes that exact production action.
4. Write or migrate production D1 only with explicit approval for the exact operation.
5. Never print, log, commit, document, or persist secrets. Use approved interactive or Worker-secret workflows only.
6. Make the smallest targeted change that satisfies the request.
7. Do not perform unrelated refactors, cleanup, dependency changes, or formatting churn.
8. Do not reread the whole repository or repeat a completed audit when the relevant state is already verified.
9. Read only the files and documentation relevant to the current task.
10. Reuse existing infrastructure, scripts, patterns, and configuration before adding anything new.
11. Treat AI-generated or external data as untrusted input; validate it at boundaries.
12. Preserve authentication, authorization, super-admin checks, tenant isolation, rate limits, and resource ownership checks.
13. Keep D1 queries parameterized and bounded. Avoid unbounded scans and per-row query loops.
14. Preserve O(1) runtime aggregate reads and the deferred ReportView architecture unless the task explicitly changes them.
15. For UI work only, use UI UX Pro Max and 21st.dev where relevant. Do not use design skills for backend-only work.
16. Use skills and tools only when directly relevant; do not load unrelated skills or references.
17. Do not add a framework, dependency, automation, or memory system solely for agent convenience.
18. Do not deploy, migrate, merge, push, or mutate a remote service unless the user explicitly requests it.

## Token-efficient workflow

1. Read this file, then inspect the exact target and only its relevant callers, tests, and documentation.
2. For a large task, state a short plan based on those files; avoid broad discovery.
3. Implement the smallest coherent change and preserve established project patterns.
4. Run only validations relevant to changed files. Do not chase unrelated failures.
5. Inspect the final diff for scope, secrets, and unintended changes.
6. Keep final reports concise and link to existing documentation instead of repeating it.

## Current verified architecture

- Dashboard payloads are reduced; ReportView is deferred, authenticated, owner-scoped, private, and `no-store`.
- Runtime Dashboard/Admin aggregates are O(1); Admin bootstrap and pagination are bounded.
- Tenant isolation is mandatory across all user-owned resources.
- The How It Works video uses YouTube, not Cloudflare Stream.
- Production TLS minimum is 1.2 with the PCI cipher profile.
- Edge rate limiting protects `/api/auth/*`.
- Workers Paid is enabled.
- Production remains untouched by the prepared migration/reconciliation work.

## Documentation routing

- `AI_CONTEXT.md`: concise architecture and product invariants.
- `PROJECT_STATUS.md`: verified project and environment status.
- `MIGRATION_NOTES_V2.md`: migration history and compatibility notes.
- `README.md`: setup, commands, and application overview.
- `docs/SECURITY_SCALABILITY.md`: security and scalability findings.
- `docs/STAGING_PREFLIGHT.md`: staging identity and deployment checks.
- `docs/PRODUCTION_MIGRATION_RUNBOOK.md`: authoritative production reconciliation, migration order, verification, and recovery procedure.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
