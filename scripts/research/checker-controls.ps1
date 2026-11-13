function Get-CheckerCommands {
    param(
        [ValidateSet('Start', 'Stop', 'Resume')][string]$Action,
        [string]$State
    )
    if ($State -notin @('Ready', 'Running', 'Queued', 'Disabled')) { return '' }
    switch ($Action) {
        Start {
            if ($State -eq 'Disabled') { return 'Enable,Start' }
            if ($State -eq 'Ready') { return 'Start' }
        }
        Stop { if ($State -ne 'Disabled') { return 'Disable' } }
        Resume { if ($State -eq 'Disabled') { return 'Enable' } }
    }
    return ''
}
