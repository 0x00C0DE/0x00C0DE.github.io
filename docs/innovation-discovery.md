# Innovation discovery

The [Innovation discovery workflow](../.github/workflows/innovation-discovery.yml)
runs at minute 32 every two hours UTC and supports **Run workflow** on the
default branch. Edit the workflow cron to change the schedule. Each run uploads
Markdown and JSON reports plus a bounded history snapshot. Start with
report.md, then use report.json for automation or history.json to recover
the registry and backlog. Production research permissions are read-only.
Pull requests run the mocked research suite without querying GitHub.

The existing release-metadata and Trending workflow runs on its own schedule.
The checked-in publication policy enables its reviewed implementation and
handoff path. The Windows task keeps its PT55M cadence and applies the policy
from the exact main revision. Feature candidates still pass automated review,
tests, Pages deployment and live verification before the release reporter
creates a chat.

The shipping preflight runs the same Innovation Discovery engine against the
current Trending evidence. It includes ranked, evidence-backed leads in the
handoff. The local signed-in Codex runner checks novelty against the site,
ranks concrete adaptations, and implements a standalone experience using
upstream React Bits. The verifier checks any cited idea ID against the
repository and its current Trending README. Ranked ideas are tried before
uncited fallbacks, and published commits record the innovation ID and technique.
If GitHub limits metadata access, current Trending READMEs can supply
independent design inspiration. These leads permit original site code and
the verified React Bits catalog, with upstream code reuse excluded.
The separate Innovation workflow still publishes the broader research backlog.
A cycle can end without a release when the runner is unavailable or all
candidates fail review or browser verification.
Setting the publication policy mode to research-only pauses automatic feature
implementation and handoff while both research workflows continue producing
reports. Preserve artifacts and checkpoints from prior releases for
reconciliation.

## Run locally

From the repository root with Node.js 24:

    node scripts/innovation/run.mjs
    node --test tests/research-innovation.test.mjs
    node --test "tests/research-*.test.mjs"

The CLI accepts an optional output directory. The default tmp/innovation
directory is ignored by Git. Set GH_TOKEN to a read-only GitHub token if
anonymous API capacity is insufficient.

## Discovery and ranking

Trending is best effort. The engine shares the existing defensive daily,
weekly, and monthly parser, collects metadata through official GitHub API
queries, and deduplicates by case-insensitive repository name. Queries rotate
through seed and learned topics and also sample young repositories with early
engagement, active established JavaScript projects, curated lists, and
cross-domain visualization. The early stars and recent-push filters are
shortlisting signals. Actual growth is the difference between stored
observations on distinct dates. A fresh repository has unknown growth.

A topic outside the seeds becomes eligible after appearing on two distinct
repositories. An active learned topic gets a dedicated search slot. These
searches also find related topics from the newly returned metadata. A search
counts as successful when it adds a previously unseen candidate with the topic
and a provisionally compatible license. Repeated low-yield searches lose
priority and can become inactive. History records the source, first detection,
last observation and evaluation, support, relevance, and success rate.
Unfiltered Trending and keyword-independent searches remain eligible sources.

The engine reviews a shortlist within a request budget. README evidence is
cached by GitHub's pushed timestamp. When a model is configured, it can also
receive a bounded number of dependency manifests read as data. Repository
evidence records an excerpt and its source path. An adaptation is a hypothesis
for the static post-entry terminal site, with proposed implementation steps,
performance, compatibility, and security considerations. Scores are normalized
over the available weighted criteria. The confidence percentage measures the
coverage of the scoring rubric. Missing evidence reduces coverage. Category
round-robin selection keeps one category from occupying every report slot.
Unacceptable security or infrastructure assessments are rejected. Reuse of
upstream code with an unrecognized license is deferred for review.

History uses schema version 1. Actions restores the latest cache and publishes
a snapshot with each report. Cache eviction can reset continuity. To recover
locally, restore an earlier artifact's history.json into the output directory.
The engine retains repository observations, discovered topics and a backlog of
stable proposal IDs. Existing accepted or implemented statuses in restored
history are preserved. A rejected idea is eligible for reconsideration if
its source evidence changes. Curate backlog statuses in history.json when
running locally. Automated sync of human decisions is future work.

## Budgets and optional AI

Set the following environment variables locally, or use repository Actions
variables where the workflow maps them through.

| Variable suffix after INNOVATION_ | Default | Purpose |
| --- | ---: | --- |
| REQUESTS | 32 | Maximum GitHub API requests |
| REPOSITORIES | 60 | Maximum unique discovery candidates |
| SEARCHES | 8 | Maximum search queries |
| INSPECTIONS | 8 | Maximum README lookups |
| TOPICS | 180 | Maximum retained topics |
| RETENTION | 240 | Maximum retained repositories and proposals, each |
| PROPOSALS | 12 | Maximum reported or returned model proposals |
| DURATION_MS | 100000 | End-to-end network and adapter deadline in milliseconds |
| AI_CANDIDATES | 4 | Maximum repositories in the model batch |
| AI_TOKENS | 8000 | Token budget passed to the adapter |
| WEIGHTS | built-in | JSON with originality, compatibility, feasibility, experience, momentum, maintainability and suitability weights |

By default, hosted runs use deterministic experimental proposals and require no
AI credentials. For cross-domain AI synthesis, set INNOVATION_AI_ADAPTER to a
trusted Node script that reads one JSON object from stdin and prints a JSON
array to stdout. Use INNOVATION_AI_VERSION to invalidate cached synthesis when
the prompt, model, or adapter changes. The adapter is responsible for setting
its provider's real token limits and authenticating. For hosted use, make the
trusted script available in the default-branch checkout and set the same
repository variable. Wire its provider credential through Actions secrets
only. The workflow does not assume access to desktop Codex or subscription
quota. For local use, the adapter can use a separately configured supported
Codex CLI or model API.

The input contains the task, site constraints, a field list, weights, budgets
and a bounded list of repository records with README evidence and optional
manifests. Return one object per idea, with sources containing repository
names from the input and evidence containing repository and exact excerpt
properties. Numeric ratings use 0–10. Leave unsupported ratings absent.
Mark unacceptableRisk, impossibleInfrastructure, or incompatibleLicense true
when applicable. The engine checks the evidence against supplied text,
bounds the response, and reuses validated results when selected revisions,
inputs and adapter version match. Keep the adapter read-only and tool-free
when handling upstream excerpts.

The system measures updates it can observe. Search metadata alone cannot
establish that a recent push introduced significant functionality. A reviewer
should validate dependency licenses, exact source behavior, browser support,
and site novelty before authorizing an implementation. Tags and README text
are discovery signals and may be incomplete.
