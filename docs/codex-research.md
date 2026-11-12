# Codex research preflight

The [workflow](../.github/workflows/codex-autonomous-research.yml) wakes every
six hours on the repository default branch. A push to main that changes the
workflow or research code also triggers a report. Pull requests run the mocked tests.
Scheduled runs poll the official GitHub release endpoints for Pretext,
Playwright, Wrangler, the Pages deploy action, and Impeccable. A release is an
input for review. The report stores bounded release metadata and excludes
release-note prose. A failed source is listed in the summary and its prior
deduplication state is retained.

GitHub Actions serializes scheduled and manual report runs. The cache restores
up to 500 recent metadata hashes and can be evicted. Each successful run
publishes a JSON artifact with 30-day retention. Initial runs and runs after
cache eviction can report previously seen releases. The Pages artifact is
built from its existing explicit allowlist.

## Local commands

Run from the repository root with Node 24.

```powershell
node --test tests/research-preflight.test.mjs tests/research-releases.test.mjs tests/research-features.test.mjs
node scripts/research/report.mjs
```

The report command uses read-only HTTPS and writes under `tmp/codex-research`.
Use a separate state directory for concurrent local invocations. The optional
second positional argument is an ignored local JSON planning input.

### Account-plan planning

Set `mode` to `chatgpt-plan` and supply an `observation` with `observedAt`,
`weeklyResetAt`, `weeklyRemaining`, and `previousWeeklyResetAt` when verified.
For a plan with a short window also include `shortResetAt` and
`shortRemaining`. Set `shortWindowApplies` to false only if account
information establishes that the short window is inapplicable. Read values from
supported account usage UI and include explicit timezone offsets. The preflight
accepts observations up to four hours old and requires a fresh observation
after the reset. Window fractions are in [0, 1]. Task costs in those units
require independent calibration.

### API planning

Set `mode` to `openai-api` and supply `api` with `observedAt`, `periodStart`,
`periodEnd`, `limitCents`, `bookedCents`, and `pendingCents`. Use a verified
internal seven-day period and whole US cents. Pending cents represent reserved
or unreconciled costs. This is planning input and API costs still need separate
provider reconciliation. See [OpenAI's non-interactive Codex documentation](https://learn.chatgpt.com/docs/non-interactive-mode).

Each task takes `id`, positive `value`, `confidence` in [0, 1], and `risk`.
Optional flags are `urgent` and `frontend`. Use `apiCostCents` for API mode or
`weeklyFraction` and `shortFraction` for plan mode. An eligible task appears in
the report as a candidate for review. Missing inputs yield a deterministic
research-only run. The preflight has no authority to launch models or spend
money.

## Design workflow

The workspace skill identifies itself as Impeccable 4.8.2 and pins its engine
to 0.1.22 with a checksum manifest. The
[official project](https://github.com/pbakaus/impeccable) documents Codex
installation and project hook trust. Use an approved version and verify the
release assets before running the installer or accepting any hook. The local
context launcher needs the verified engine in its cache or a configured path
to the verified engine. Scheduled release monitoring requires neither.

Read [PRODUCT.md](../PRODUCT.md) and [DESIGN.md](../DESIGN.md) for project
context. For a UI task use the installed skill's task-specific playbook,
context loader, and craft guidance. Verify the actual render and reuse the
mobile and desktop Playwright suites.

## Site feature discovery and release handoff

Each report audits the current home and project index HTML and a bounded
prefix of the blog for concrete feature signals. Candidates include
evidence, acceptance criteria, and a rough value-to-effort order. These
heuristics are a starting point for validation. Release metadata remains
a separate research input.

The report records the source revision in Actions and the repository
[release skill](../.agents/skills/0x00c0de-release/SKILL.md) to load before
implementing a candidate. Follow the skill to start a fresh branch from
current main, run checks, publish, integrate, and verify production.
Feature candidates may recur while their source signals remain present.

The scheduled workflow produces a research handoff. A model runner and
automatic implementation or merge job are not configured. Dependency
audits, CodeQL, and Pages checks continue to run independently.
