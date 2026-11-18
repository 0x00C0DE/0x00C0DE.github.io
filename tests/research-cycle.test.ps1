$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../scripts/research/research-cycle.ps1')

function Assert-Equal($actual, $expected) {
    if ($actual -cne $expected) { throw "Expected '$expected', got '$actual'." }
}
$state = @{ generations = 0; validations = 0; notes = @() }
$ok = Invoke-ResearchEvaluation -Generate {
    param($feedback)
    $state.generations++
    $state.notes += $feedback
} -Validate {
    $state.validations++
    if ($state.validations -eq 1) { throw 'Incomplete Trending assessment coverage: monthly/example/repo' }
} -Feedback 'Earlier candidate failed keyboard navigation.' 3>$null
Assert-Equal $ok $true
Assert-Equal $state.generations 2
Assert-Equal $state.validations 2
if ($state.notes[1] -notmatch 'monthly/example/repo') { throw 'Repair lost validation diagnostics.' }
if ($state.notes[1] -notmatch 'keyboard navigation') { throw 'Repair lost previous candidate feedback.' }

$state = @{ generations = 0 }
$ok = Invoke-ResearchEvaluation -Generate { $state.generations++ } -Validate { throw 'still incomplete' } 3>$null
Assert-Equal $ok $false
Assert-Equal $state.generations 3

$state = @{ generations = 0; validations = 0 }
$ok = Invoke-ResearchEvaluation -UseExisting -Generate { $state.generations++ } -Validate {
    $state.validations++
    if ($state.validations -eq 1) { throw 'saved evaluation incomplete' }
} 3>$null
Assert-Equal $ok $true
Assert-Equal $state.generations 1
Assert-Equal $state.validations 2

$failed = $false
try {
    Invoke-ResearchEvaluation -Generate { throw 'configuration failure' } -Validate { throw 'must not run' }
} catch { $failed = $_.Exception.Message -eq 'configuration failure' }
Assert-Equal $failed $true
foreach ($code in 20, 21, 24) { Assert-Equal (Test-ResearchContinuation $code) $true }
foreach ($code in 0, 1, 22, 23) { Assert-Equal (Test-ResearchContinuation $code) $false }
Write-Output 'Evaluation repair, bounded exhaustion, saved evaluation recovery and safe continuation cases passed.'
