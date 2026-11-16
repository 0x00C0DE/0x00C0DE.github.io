function Test-ResearchPush([string[]]$RefLines, [string]$Revision, [string]$Branch) {
    return ("$Revision`trefs/heads/main" -cin $RefLines) -and
        ("$Revision`trefs/heads/$Branch" -cin $RefLines)
}

function Write-ResearchCheckpoint([string]$Path, [System.Collections.IDictionary]$Record) {
    $Record.updatedAt = [DateTimeOffset]::UtcNow.ToString('o')
    $pending = "$Path.pending"
    $Record | ConvertTo-Json -Depth 5 -Compress | Set-Content -LiteralPath $pending -Encoding utf8
    [IO.File]::Move($pending, $Path, $true)
}

function Get-ResearchJson([string]$Uri, [int]$TimeoutSeconds = 20) {
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            return Invoke-RestMethod -TimeoutSec $TimeoutSeconds -Uri $Uri
        } catch {
            $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
            # Rate limits may outlast this process. Let the next scheduled poll handle them.
            if ($attempt -eq 3 -or ($status -ne 0 -and $status -ne 408 -and $status -lt 500)) { throw }
            Write-Warning "GitHub read failed on attempt $attempt of 3 (HTTP $status). Retrying the read."
            Start-Sleep -Seconds $attempt
        }
    }
}
function Get-ResearchCandidateAction([int]$ExitCode) {
    switch ($ExitCode) {
        0 { 'complete' }
        { $_ -in (20, 21) } { 'next' }
        default { 'reconcile' }
    }
}
