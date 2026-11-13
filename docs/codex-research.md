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

The implementation job selects at most one supported candidate at the
current main revision. It can publish the public blog feed or generate a
sitemap for the portfolio's public routes. A relevant Trending match is
recorded as inspiration for the sitemap when available. The site's own
missing sitemap and public project pages also justify that change.

The job uses fixed implementations and no model credentials. It checks
the release skill, creates a fresh feature branch, verifies the exact
changed path and Pages artifact, and pushes the branch and main
atomically. If branch protection rejects that push, use the repository's
normal pull request path. Candidates without an implementation remain in
the report.

The job dispatches the existing Pages workflow explicitly because a push
using the Actions token does not trigger Pages. It checks the resulting
deployment and public feed. If publishing succeeds and deployment fails,
rerun the Pages workflow on main and check the public path printed in the release job. Review the
job summary before retrying a failed or interrupted release.

## GitHub Trending evaluation

Every scheduled report reads GitHub Trending's Today, This week, and This
month lists. It records repository ranks, merges duplicates within the run,
and maps matching descriptions to a site surface, a possible use, and a
verification check. Unmatched repositories have no proposed use. A window
is marked unavailable if GitHub is unreachable or the page format changes.

Trending results are research leads. The implementation job currently ships
only reviewed, predefined changes with an artifact test and production check.
It does not execute code or use instructions from trending repositories.

Each automated feature release adds its missing documentation to the
existing README research section in the same commit. Register a README
entry in `scripts/research/document-feature.mjs` when adding a supported
feature. The release stops if that entry is missing.

## Codex CLI feature releases

Use a dedicated clean checkout on a trusted Windows machine with PowerShell,
Git, Node.js 24, and a current native Codex executable on PATH that supports
`gpt-6.1-sol` and app-server. The Windows runner can also find the installed
Codex desktop package or use the executable in `CODEX_RESEARCH_EXECUTABLE`.
Run `codex.exe login` to sign in with
ChatGPT if needed. The local runner checks the login method and leaves
account credentials on that machine. The public GitHub Actions workflow
continues research and predefined releases without a Codex credential.
The runner explicitly enables the native Windows sandbox because it ignores
user configuration. Proposal runs use workspace-write and review runs use read-only.
Use `node --test --test-isolation=none` in those sandboxes so Node runs the tests
in-process.

From a dedicated checkout at the latest main, preview a proposal with:

```powershell
pwsh -NoProfile -File scripts/research/run-codex-local.ps1
```

Add `-Publish` to publish after a separate read-only Codex review approves
with no findings. That review checks behavior, runs the focused and research
tests inside the CLI sandbox, and checks the README update. The runner
checks the allowed file paths and modes, builds Pages, and verifies main
still matches the reviewed base before pushing. It uses the repository's
normal atomic feature-branch and main push. If branch rules reject the push,
use the required PR path. After a successful push it verifies the Pages run
for that revision and checks that the public home page is reachable.

Preview leaves the proposal staged. Failed checks and reviews leave the
branch available for diagnosis. For unattended use, schedule the command
on the signed-in host under the same user account. Start each cycle in a
clean checkout at current main. The hosted schedule does not start the
local runner. Stop the host schedule to stop new local cycles.

### Automatic Windows handoff

The hosted workflow announces an eligible lead in a successful handoff job.
The signed-in host runs `poll-local-handoff.ps1 -Publish` every 2 hours and 30 minutes
while the Windows user is signed in. It prefers a successful handoff for current
main. If current main has no successful or pending hosted run in the last six
hours, the host can research Trending locally, once per six hours. It checks
that main still matches before starting the isolated worktree and again before
publication. A recent, successful hosted run with no lead counts as completed research.
Once the Projects page exposes native navigation, that specific lead is skipped.

The bridge records claims and receipts under `tmp/local-handoff` before running
Codex. A receipt distinguishes `no-handoff`, `no-proposal`, `previewed`, `published`,
and `needs-review`. Publication checks the exact Pages revision and verifies
the changed public files. Inspect the receipt and worktree before retrying an
interrupted or failed release.
If the machine is off or signed out, eligible work waits until it is back
online. To stop automatic polling, disable the Windows task
`0x00C0DE Codex Research Handoff`.

### Checker control panel

Double-click [Open-Checker-Panel.cmd](../scripts/research/Open-Checker-Panel.cmd)
in the local checkout to see the current Windows checker status, last result,
and next check. The panel uses the existing task under the signed-in account.

- **Start** enables the checker if paused and requests a check now.
- **Stop** disables future checks. An active check or release can finish.
- **Resume** enables the existing schedule.

Closing the window leaves the selected schedule in effect. The panel controls
Windows polling. GitHub Actions research continues on its hosted schedule.

### Open-ended Trending discovery

The hosted job signals discovery when its report contains Trending repositories.
The Windows runner refreshes the report against current main and requests a
read-only Codex evaluation for every repository in each daily, weekly, and
monthly list. Repositories that rank in several lists get an assessment in
each. The runner verifies coverage and stops for review if a list was
unavailable or an assessment was missing.

Each cycle selects at most one original feature and implements it in an
ephemeral Codex session in the isolated checkout. The runner independently
reviews the changes and the browser test plan, builds the Pages artifact,
and runs the plan in desktop and touch-sized Chromium outside the model's
sandbox. Install the repository's Playwright dependency and Chromium in the
trusted primary checkout with `npm.cmd ci` and `npx.cmd playwright install chromium`.
The Windows poller uses that checkout by default. Set
`CODEX_RESEARCH_BROWSER_ROOT` to the directory containing the trusted
`node_modules/playwright` installation to override it.

The reporting automation opens a project chat after the exact release SHA
deploys and the changed public files are verified. A cycle with no qualifying
feature records `no-proposal`. Failed browser checks retain the proposal for review.
