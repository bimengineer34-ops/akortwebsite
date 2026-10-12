# Uygulama aşamaları ve Definition of Done
P0 Audit/backup + tests baseline + design screenshot snapshots + gap matrix.
P1 Shared adapters/roles/audit/migrations/queue/media/approvals.
P2 Live SEO + mandatory covers for NEW content + GSC/sitemap + Speed Engine safeguards.
P3 AI Content Studio providers, selected text AI actions, source checks, budgets.
P4 Social Studio accounts, Brand Kit, templates, calendar, approval, queued publication, analytics.
P5 Market/Media Intelligence + competitor + backlink + CRM opportunity flows.
P6 QA, security/performance/accessibility, staged rollout and observability.

Acceptance test matrix:
- Existing routes/forms/auth and existing stored posts unchanged; screenshot visual regression desktop/mobile.
- No unapproved social publication, no duplicate publication, no cross-user access, no secret in logs.
- API token expired/disconnected/rate limit/network failure, queue retry, dedupe tests.
- Stale cache on publish and public caching of private admin responses forbidden.
- SEO editor persists all metadata; published image URLs valid; sitemap canonical correct.
- Source provenance and legal access, duplicate topics; fake 'live' values forbidden.
- Frontend keyboard and contrast accessibility; screen sizes desktop/tablet/mobile.
- Build, unit/integration/E2E security tests; phase checklists only marked done with passing evidence.

Deliver final: changed file inventory, commands for installation/migrations/tests, env placeholders, configured/unconfigured providers, deployment and rollback instructions, actual screenshots.
