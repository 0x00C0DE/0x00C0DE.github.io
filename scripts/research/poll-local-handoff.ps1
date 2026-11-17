param([switch]$Publish, [string]$StateDirectory = 'tmp/local-handoff')

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Resolve-Path (Join-Path $PSScriptRoot '../..'))
. (Join-Path $PSScriptRoot 'release-recovery.ps1')

function Git {
    & git.exe @args
    if ($LASTEXITCODE -ne 0) { throw "Git failed: $($args[0])" }
}

$remote = Git remote get-url origin
if ($remote -notmatch '^(https://github\.com/|git@github\.com:)0x00C0DE/0x00C0DE\.github\.io(\.git)?$') {
    throw 'Unexpected origin for the local research bridge.'
}
$state = New-Item -ItemType Directory -Force $StateDirectory
$browserRoot = if ($env:CODEX_RESEARCH_BROWSER_ROOT) {
    $env:CODEX_RESEARCH_BROWSER_ROOT
} elseif (Test-Path -LiteralPath '../0x00C0DE.github.io/node_modules/playwright/package.json') {
    (Resolve-Path -LiteralPath '../0x00C0DE.github.io').Path
} else {
    (Get-Location).Path
}
$lock = [IO.File]::Open((Join-Path $state.FullName 'poll.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
try {
    $api = 'https://api.github.com/repos/0x00C0DE/0x00C0DE.github.io'
    $main = (Get-ResearchJson "$api/git/ref/heads/main").object.sha
    # Resolve policy from the exact remote revision before consuming any receipt.
    Git fetch origin main
    if ((Git rev-parse FETCH_HEAD) -ne $main) { return }
    $policy = Git show "${main}:scripts/research/publication-policy.json" | ConvertFrom-Json
    if ($policy.mode -eq 'research-only') {
        Write-Output 'Research-only mode. The scheduled innovation workflow produces reports.'
        return
    }
    if ($policy.mode -ne 'legacy-publication') { throw 'Invalid scheduled research publication policy.' }
    $env:CODEX_RESEARCH_HISTORY_PATH = Join-Path $state.FullName 'research-history.json'
    $quotaPath = Join-Path $state.FullName 'codex-quota.json'
    $handoff = $null
    $resumeReport = $null
    $resumeEvaluation = $null
    if (Test-Path -LiteralPath $quotaPath) {
        $quota = Get-Content -Raw -LiteralPath $quotaPath | ConvertFrom-Json
        $retryAt = [DateTimeOffset]$quota.retryAt
        if ([DateTimeOffset]::UtcNow -lt $retryAt) {
            Write-Output "Codex quota deferred until $retryAt."
            return
        }
        if ($quota.runId -notmatch '^(?:local-|resume-)?\d+$') { throw 'Invalid quota receipt run ID.' }
        if ($quota.revision -ceq $main) {
            $previous = Join-Path $state.FullName "run-$($quota.runId)/tmp"
            $previousReport = Join-Path $previous 'codex-research/report.json'
            $previousEvaluation = Join-Path $previous 'trending-evaluation.json'
            if ((Test-Path -LiteralPath $previousReport) -and (Test-Path -LiteralPath $previousEvaluation)) {
                $resumeReport = $previousReport
                $resumeEvaluation = $previousEvaluation
            }
        }
        $runId = "resume-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
        $receipt = Join-Path $state.FullName "$runId.json"
        $handoff = '{"discovery":true}'
    }
    $query = "$api/actions/workflows/codex-autonomous-research.yml/runs?branch=main&head_sha=$main&per_page=10"
    $runs = if (!$handoff) { (Get-ResearchJson $query).workflow_runs }
    foreach ($run in $runs) {
        if ($run.head_sha -ne $main -or $run.conclusion -ne 'success') { continue }
        $receipt = Join-Path $state.FullName "$($run.id).json"
        if (Test-Path -LiteralPath $receipt) { continue }
        $jobs = (Get-ResearchJson "$api/actions/runs/$($run.id)/jobs").jobs
        $inputPath = Join-Path $state.FullName 'candidate.json'
        @{ run = $run; jobs = $jobs } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $inputPath -Encoding utf8
        $handoff = & node scripts/research/local-handoff.mjs read $inputPath $main
        if ($LASTEXITCODE -ne 0) { throw 'Could not validate the handoff.' }
        if (-not $handoff) {
            '{"status":"no-handoff"}' | Set-Content -LiteralPath $receipt -Encoding utf8
            continue
        }
        $runId = $run.id
        break
    }

    if (-not $handoff) {
        $attemptPath = Join-Path $state.FullName 'last-local-research.txt'
        $lastAttempt = if (Test-Path -LiteralPath $attemptPath) {
            [long](Get-Content -Raw -LiteralPath $attemptPath)
        }
        $fallbackInput = Join-Path $state.FullName 'fallback.json'
        @{ runs = @($runs | Where-Object { $_ }); lastAttempt = $lastAttempt } |
            ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $fallbackInput -Encoding utf8
        $fallback = & node scripts/research/local-handoff.mjs fallback $fallbackInput $main
        if ($LASTEXITCODE -ne 0) { throw 'Could not evaluate research freshness.' }
        if ($fallback -ne 'true') {
            Write-Output 'Waiting for an eligible hosted handoff or the next local research interval.'
            return
        }
        $attempt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $runId = "local-$attempt"
        $receipt = Join-Path $state.FullName "$runId.json"
    }

    Git fetch origin main
    if ((Git rev-parse FETCH_HEAD) -ne $main) {
        Write-Output 'Main advanced before checkout. The next poll will reassess.'
        return
    }
    $checkout = Join-Path $state.FullName "run-$runId"
    Git worktree add --detach $checkout $main
    $removeCheckout = $true
    try {
        if (-not $handoff) {
            Write-Output "Researching GitHub Trending locally for $main ($runId)."
            $env:GITHUB_SHA = $main
            Push-Location -LiteralPath $checkout
            try {
                & node scripts/research/report.mjs
                if ($LASTEXITCODE -ne 0) { throw 'Local research failed.' }
                $handoff = & node scripts/research/local-handoff.mjs select tmp/codex-research/report.json $main
                if ($LASTEXITCODE -ne 0) { throw 'Could not select a local handoff.' }
            } finally {
                Pop-Location
            }
            if (-not $handoff) {
                '{"status":"no-handoff"}' | Set-Content -LiteralPath $receipt -Encoding utf8
                Write-Output 'Local research found no eligible Trending lead.'
                return
            }
        }

        $report = Join-Path $state.FullName "handoff-$runId.json"
        $handoff | Set-Content -LiteralPath $report -Encoding utf8
        $description = & node scripts/research/codex-proposal.mjs describe $report $runId
        if ($LASTEXITCODE -ne 0) { throw 'Could not describe the Trending handoff.' }
        $description = $description | ConvertFrom-Json
        $leadName = $description.lead
        $surface = $description.surface
        $key = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData(
            [Text.Encoding]::UTF8.GetBytes("$main|$($leadName.ToLowerInvariant())|$surface")))
        $claim = Join-Path $state.FullName "$key.claim"
        if (Test-Path -LiteralPath $claim) {
            '{"status":"already-claimed"}' | Set-Content -LiteralPath $receipt -Encoding utf8
            return
        }
        $options = @('-BrowserDependencies', $browserRoot)
        if ($resumeReport) {
            $destination = Join-Path $checkout 'tmp/codex-research'
            New-Item -ItemType Directory -Force $destination | Out-Null
            Copy-Item -LiteralPath $resumeReport -Destination (Join-Path $destination 'report.json')
            $options += @('-ReportPath', (Join-Path $destination 'report.json'), '-EvaluationPath', $resumeEvaluation)
        }
        if ($attempt) {
            $options += @('-ReportPath', (Join-Path $checkout 'tmp/codex-research/report.json'))
        }
        if ($Publish) { $options += '-Publish' }
        "run=$runId" | Set-Content -LiteralPath $claim -Encoding utf8
        [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() |
            Set-Content -LiteralPath (Join-Path $state.FullName 'last-local-research.txt') -Encoding ascii
        '{"status":"started"}' | Set-Content -LiteralPath $receipt -Encoding utf8
        Write-Output "Handing off $leadName ($runId)."
        $removeCheckout = $false
        $runnerLog = Join-Path $state.FullName "runner-$runId.log"
        if (Test-Path -LiteralPath $quotaPath) {
            Move-Item -LiteralPath $quotaPath -Destination (Join-Path $state.FullName "$runId-quota-consumed.json")
        }
        & (Get-Process -Id $PID).Path -NoProfile -NonInteractive -WindowStyle Hidden -File `
            (Join-Path $checkout 'scripts/research/run-codex-local.ps1') @options *> $runnerLog
        $runnerExit = $LASTEXITCODE
        foreach ($artifact in 'trending-evaluation.json', 'trending-selection.json', 'feature-browser-plan.json') {
            $source = Join-Path $checkout "tmp/$artifact"
            if (Test-Path -LiteralPath $source) {
                Copy-Item -LiteralPath $source -Destination (Join-Path $state.FullName "$runId-$artifact")
            }
        }
        $status = switch ($runnerExit) {
            0 { if ($Publish) { 'published' } else { 'previewed' } }
            20 { 'no-proposal' }
            21 { 'needs-review' }
            22 { if ($Publish) { 'partially-published' } else { 'partially-previewed' } }
            23 {
                $retry = Get-Content -Raw -LiteralPath (Join-Path $checkout 'tmp/codex-quota.json') | ConvertFrom-Json
                Write-ResearchCheckpoint $quotaPath @{
                    retryAt = ([DateTimeOffset]$retry.retryAt).ToString('o'); revision = $main; runId = "$runId"
                }
                'quota-deferred'
            }
            default { throw "Local runner failed for $runId (exit $runnerExit). Inspect $runnerLog and $checkout before retrying." }
        }
        @{ status = $status } | ConvertTo-Json -Compress | Set-Content -LiteralPath $receipt -Encoding utf8
        Write-Output "Handoff result: $status ($runId)."
        $removeCheckout = $status -in ('published', 'no-proposal')
        if ($runnerExit -in (21, 22)) { exit $runnerExit }
    } catch {
        @{ status = 'needs-review'; phase = $_.InvocationInfo.ScriptLineNumber } |
            ConvertTo-Json -Compress | Set-Content -LiteralPath $receipt -Encoding utf8
        throw
    } finally {
        if ($removeCheckout -and -not (Git -C $checkout status --porcelain)) { Git worktree remove $checkout }
    }
} finally {
    $lock.Dispose()
}
