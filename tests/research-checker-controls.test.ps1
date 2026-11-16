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

. (Join-Path $PSScriptRoot '../scripts/research/worktree-cleanup.ps1')
function Invoke-Checked { throw 'simulated Filename too long' }
$warnings = @(Remove-ResearchWorktree $PSScriptRoot (Split-Path -Parent $PSScriptRoot) 3>&1)
Assert-Equal $warnings.Count 1
if ($warnings[0].Message -notmatch 'Filename too long') { throw 'Cleanup failure was not logged.' }
Write-Output 'Cleanup failure leaves the batch running.'
