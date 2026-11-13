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
