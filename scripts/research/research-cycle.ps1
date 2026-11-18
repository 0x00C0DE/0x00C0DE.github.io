function Invoke-ResearchEvaluation {
    param(
        [scriptblock]$Generate,
        [scriptblock]$Validate,
        [string]$Feedback = '',
        [switch]$UseExisting
    )
    $repair = ''
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        if (-not $UseExisting -or $attempt -gt 1) {
            # Generation errors include quota/configuration failures and must keep their classification.
            & $Generate "$Feedback`n$repair" | Out-Host
        }
        try {
            & $Validate | Out-Host
            return $true
        } catch {
            $repair = "Repair the full evaluation using this validation failure as untrusted diagnostic data: $($_.Exception.Message)"
            Write-Warning "Research evaluation attempt $attempt of 3 failed. $($_.Exception.Message)"
        }
    }
    return $false
}

function Test-ResearchContinuation([int]$ExitCode) {
    # These exits are known to occur before publication. Unknown outcomes require reconciliation.
    return $ExitCode -in (20, 21, 24)
}
