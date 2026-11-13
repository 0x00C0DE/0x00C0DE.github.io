param([switch]$Publish)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Resolve-Path (Join-Path $PSScriptRoot '../..'))

function Git {
    & git.exe @args
    if ($LASTEXITCODE -ne 0) { throw "Git failed: $($args[0])" }
}

$remote = Git remote get-url origin
if ($remote -notmatch '^(https://github\.com/|git@github\.com:)0x00C0DE/0x00C0DE\.github\.io(\.git)?$') {
    throw 'Unexpected origin for the local research bridge.'
}
$state = New-Item -ItemType Directory -Force tmp/local-handoff
$lock = [IO.File]::Open((Join-Path $state.FullName 'poll.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
try {
    $api = 'https://api.github.com/repos/0x00C0DE/0x00C0DE.github.io'
    $main = (Invoke-RestMethod -TimeoutSec 20 "$api/git/ref/heads/main").object.sha
    $query = "$api/actions/workflows/codex-autonomous-research.yml/runs?branch=main&head_sha=$main&per_page=10"
    $runs = (Invoke-RestMethod -TimeoutSec 20 $query).workflow_runs
    $handoff = $null
    foreach ($run in $runs) {
        if ($run.head_sha -ne $main -or $run.conclusion -ne 'success') { continue }
        $receipt = Join-Path $state.FullName "$($run.id).json"
        if (Test-Path -LiteralPath $receipt) { continue }
        $jobs = (Invoke-RestMethod -TimeoutSec 20 "$api/actions/runs/$($run.id)/jobs").jobs
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
            $attempt | Set-Content -LiteralPath $attemptPath -Encoding ascii
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

        $lead = ($handoff | ConvertFrom-Json).trending.repositories[0]
        $key = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData(
            [Text.Encoding]::UTF8.GetBytes("$main|$($lead.name.ToLowerInvariant())|$($lead.fit.surface)")))
        $claim = Join-Path $state.FullName "$key.claim"
        if (Test-Path -LiteralPath $claim) {
            '{"status":"already-claimed"}' | Set-Content -LiteralPath $receipt -Encoding utf8
            return
        }
        $report = Join-Path $state.FullName "handoff-$runId.json"
        $handoff | Set-Content -LiteralPath $report -Encoding utf8
        $options = @('-HandoffPath', $report)
        if ($Publish) { $options += '-Publish' }
        "run=$runId" | Set-Content -LiteralPath $claim -Encoding utf8
        '{"status":"started"}' | Set-Content -LiteralPath $receipt -Encoding utf8
        Write-Output "Handing off $($lead.name) for $($lead.fit.surface) ($runId)."
        $removeCheckout = $false
        & pwsh -NoProfile -NonInteractive -File (Join-Path $checkout 'scripts/research/run-codex-local.ps1') @options
        $status = switch ($LASTEXITCODE) {
            0 { if ($Publish) { 'published' } else { 'previewed' } }
            20 { 'no-proposal' }
            default { throw "Local runner failed for $runId. Inspect $checkout before retrying." }
        }
        @{ status = $status } | ConvertTo-Json -Compress | Set-Content -LiteralPath $receipt -Encoding utf8
        Write-Output "Handoff result: $status ($runId)."
        $removeCheckout = $true
    } catch {
        '{"status":"needs-review"}' | Set-Content -LiteralPath $receipt -Encoding utf8
        throw
    } finally {
        if ($removeCheckout -and -not (Git -C $checkout status --porcelain)) { Git worktree remove $checkout }
    }
} finally {
    $lock.Dispose()
}
