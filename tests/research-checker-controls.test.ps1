$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../scripts/research/checker-controls.ps1')
function Assert-Equal($actual, $expected) {
    if ($actual -ne $expected) { throw "Expected '$expected', got '$actual'." }
}
Assert-Equal (Get-CheckerCommands Start Disabled) 'Enable,Start'
Assert-Equal (Get-CheckerCommands Start Ready) 'Start'
Assert-Equal (Get-CheckerCommands Stop Running) 'Disable'
Assert-Equal (Get-CheckerCommands Resume Disabled) 'Enable'
Assert-Equal (Get-CheckerCommands Start Running) ''
Assert-Equal (Get-CheckerCommands Resume Ready) ''
Write-Output 'Six checker control cases passed.'

$runner = Join-Path $PSScriptRoot '../scripts/research/run-codex-local.ps1'
$syntax = [System.Management.Automation.Language.Parser]::ParseFile(
    $runner, [ref]$null, [ref]$null)
$wrapper = $syntax.Find({
    param($node)
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Invoke-Checked'
}, $true)
. ([scriptblock]::Create($wrapper.Extent.Text))
Assert-Equal (Invoke-Checked node -p 'JSON.stringify(process.argv.slice(1))' '--' '-A' '--atomic') '["-A","--atomic"]'
Write-Output 'Native command flag forwarding passed.'
Assert-Equal (Invoke-Checked node --version) (& node --version)
Write-Output 'Single native command argument passed.'

$diagnostics = [IO.Path]::GetTempFileName()
try {
    $script:verificationLog = $diagnostics
    $failed = $false
    try {
        Invoke-Checked node -e 'console.error("diagnostic fixture"); process.exit(7)' | Out-Null
    } catch {
        $failed = $_.Exception.Message -match 'exit code 7'
    }
    Assert-Equal $failed $true
    if ((Get-Content -Raw $diagnostics) -notmatch 'diagnostic fixture') { throw 'Diagnostic output was lost.' }
} finally {
    $script:verificationLog = $null
    Remove-Item -LiteralPath $diagnostics
}
Write-Output 'Failed verification preserves diagnostic output and exit status.'

. (Join-Path $PSScriptRoot '../scripts/research/worktree-cleanup.ps1')
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location -LiteralPath $repo
try {
    $actualRoot = Get-ResearchWorktreeRoot
    $common = (Resolve-Path -LiteralPath (git rev-parse --git-common-dir)).Path
    Assert-Equal $actualRoot (Split-Path -Parent $common)
} finally {
    Pop-Location
}
Write-Output 'Worktree root resolves using the installed Git version.'
function Invoke-Checked { throw 'simulated Filename too long' }
$warnings = @(Remove-ResearchWorktree $PSScriptRoot (Split-Path -Parent $PSScriptRoot) 3>&1)
Assert-Equal $warnings.Count 1
if ($warnings[0].Message -notmatch 'Filename too long') { throw 'Cleanup failure was not logged.' }
Write-Output 'Cleanup failure leaves the batch running.'

. (Join-Path $PSScriptRoot '../scripts/research/release-recovery.ps1')
$sha = 'a' * 40
$lines = @("$sha`trefs/heads/main", "$sha`trefs/heads/US-1-codex-cli-feature-v1")
Assert-Equal (Test-ResearchPush $lines $sha 'US-1-codex-cli-feature-v1') $true
Assert-Equal (Test-ResearchPush $lines[1] $sha 'US-1-codex-cli-feature-v1') $false
Assert-Equal (Test-ResearchPush $lines ('b' * 40) 'US-1-codex-cli-feature-v1') $false
Write-Output 'Remote reconciliation requires both refs at the intended revision.'

$checkpoint = [IO.Path]::GetTempFileName()
try {
    $record = @{ phase = 'push-pending'; revision = $sha }
    Write-ResearchCheckpoint $checkpoint $record
    Assert-Equal (Get-Content -Raw $checkpoint | ConvertFrom-Json).phase 'push-pending'
    $record.phase = 'deployment-pending'
    Write-ResearchCheckpoint $checkpoint $record
    Assert-Equal (Get-Content -Raw $checkpoint | ConvertFrom-Json).phase 'deployment-pending'
} finally {
    Remove-Item -LiteralPath $checkpoint
}
Write-Output 'Release checkpoint survives atomic replacement.'

Assert-Equal (Get-ResearchCandidateAction 0) 'complete'
Assert-Equal (Get-ResearchCandidateAction 20) 'next'
Assert-Equal (Get-ResearchCandidateAction 21) 'next'
Assert-Equal (Get-ResearchCandidateAction 24) 'next'
Assert-Equal (Get-ResearchCandidateAction 23) 'defer-quota'
Assert-Equal (Get-ResearchCandidateAction 1) 'reconcile'
Write-Output 'A verified release ends the cycle and an uncertain write stops fallback.'

$now = [DateTimeOffset]::Parse('2026-11-16T03:00:00-08:00')
$zone = [TimeZoneInfo]::FindSystemTimeZoneById('Pacific Standard Time')
$retry = Get-ResearchQuotaRetry @('ERROR: You have hit your usage limit. Try again at Nov 20th, 2026 5:35 PM.') $now $zone
Assert-Equal $retry ([DateTimeOffset]::Parse('2026-11-21T01:35:00Z'))
$retry = Get-ResearchQuotaRetry @('ERROR: You have hit your usage limit. Try again at 2:59 AM.') $now $zone
Assert-Equal $retry ([DateTimeOffset]::Parse('2026-11-16T10:59:00Z').AddDays(1))
Assert-Equal (Get-ResearchQuotaRetry @('ERROR: Browser timed out') $now $zone) $null
Write-Output 'Quota resets are interpreted in the runner time zone.'
