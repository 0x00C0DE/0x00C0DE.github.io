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
    $query = "$api/actions/workflows/codex-autonomous-research.yml/runs?branch=main&status=success&head_sha=$main&per_page=10"
    $runs = (Invoke-RestMethod -TimeoutSec 20 $query).workflow_runs
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
        $lead = ($handoff | ConvertFrom-Json).trending.repositories[0]
        $key = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData(
            [Text.Encoding]::UTF8.GetBytes("$main|$($lead.name.ToLowerInvariant())|$($lead.fit.surface)")))
        $claim = Join-Path $state.FullName "$key.claim"
        if (Test-Path -LiteralPath $claim) { continue }
        Git fetch origin main
        if ((Git rev-parse FETCH_HEAD) -ne $main) { return }
        $checkout = Join-Path $state.FullName "run-$($run.id)"
        Git worktree add --detach $checkout $main
        $report = Join-Path $state.FullName "handoff-$($run.id).json"
        $handoff | Set-Content -LiteralPath $report -Encoding utf8
        $options = @('-HandoffPath', $report)
        if ($Publish) { $options += '-Publish' }
        "run=$($run.id)" | Set-Content -LiteralPath $claim -Encoding utf8
        '{"status":"started"}' | Set-Content -LiteralPath $receipt -Encoding utf8
        & pwsh -NoProfile -NonInteractive -File (Join-Path $checkout 'scripts/research/run-codex-local.ps1') @options
        if ($LASTEXITCODE -ne 0) {
            '{"status":"needs-review"}' | Set-Content -LiteralPath $receipt -Encoding utf8
            throw "Local runner failed for run $($run.id). Inspect $checkout before retrying."
        }
        '{"status":"completed"}' | Set-Content -LiteralPath $receipt -Encoding utf8
        if (-not (Git -C $checkout status --porcelain)) { Git worktree remove $checkout }
        return
    }
} finally {
    $lock.Dispose()
}
