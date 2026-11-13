param([switch]$SmokeTest)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
. (Join-Path $PSScriptRoot 'checker-controls.ps1')
[Windows.Forms.Application]::EnableVisualStyles()

$taskName = '0x00C0DE Codex Research Handoff'
$form = [Windows.Forms.Form]@{
    Text = 'Codex Research Checker'
    ClientSize = [Drawing.Size]::new(550, 290)
    StartPosition = 'CenterScreen'
    FormBorderStyle = 'FixedDialog'
    MaximizeBox = $false
    AutoScaleMode = 'Font'
    Font = [Drawing.Font]::new('Segoe UI', 10)
    BackColor = [Drawing.SystemColors]::Window
    ForeColor = [Drawing.SystemColors]::WindowText
}
function Add-Label($text, $top, $height) {
    $label = [Windows.Forms.Label]@{
        Text = $text
        Location = [Drawing.Point]::new(24, $top)
        Size = [Drawing.Size]::new(502, $height)
    }
    $form.Controls.Add($label)
    return $label
}

$title = Add-Label 'Codex Research Checker' 18 36
$title.Font = [Drawing.Font]::new('Segoe UI', 18, [Drawing.FontStyle]::Bold)
$status = Add-Label '' 64 27
$status.Font = [Drawing.Font]::new('Segoe UI', 12, [Drawing.FontStyle]::Bold)
$timing = Add-Label '' 96 54
$hint = Add-Label 'Start checks now. Stop pauses future checks and lets an active run finish. Resume restores the 15-minute schedule.' 209 60
$buttons = @{}
$offset = 24
foreach ($action in 'Start', 'Stop', 'Resume') {
    $button = [Windows.Forms.Button]@{
        Text = '&' + $action
        Tag = $action
        Location = [Drawing.Point]::new($offset, 157)
        Size = [Drawing.Size]::new(126, 38)
    }
    $form.Controls.Add($button)
    $buttons[$action] = $button
    $offset += 136
}

function Format-Time($value) {
    if (!$value -or $value.Year -lt 2000) { return 'Unavailable' }
    return $value.ToString('g')
}

function Update-Panel {
    try {
        $task = Get-ScheduledTask -TaskPath '\' -TaskName $taskName
        $info = Get-ScheduledTaskInfo -InputObject $task
        $state = [string]$task.State
        $status.Text = switch ($state) {
            Disabled { 'Paused' }
            Ready { 'Scheduled' }
            Running { 'Checking or processing a finding' }
            Queued { 'Queued' }
            default { 'Status unavailable' }
        }
        $next = if ($state -eq 'Disabled') { 'Paused' } else { Format-Time $info.NextRunTime }
        $last = Format-Time $info.LastRunTime
        $result = switch ($info.LastTaskResult) {
            0 { 'completed' }
            267009 { 'running' }
            267011 { 'has not run yet' }
            default { 'result ' + $info.LastTaskResult }
        }
        $timing.Text = "Next check: $next`nLast run: $last ($result)"
        foreach ($action in $buttons.Keys) {
            $buttons[$action].Enabled = [bool](Get-CheckerCommands $action $state)
        }
    } catch {
        $status.Text = 'Checker unavailable'
        $timing.Text = 'Open Task Scheduler and check that the research task exists and your account can access it.'
        foreach ($button in $buttons.Values) { $button.Enabled = $false }
    }
}

foreach ($button in $buttons.Values) {
    $button.Add_Click({
        param($sender, $eventArgs)
        try {
            $task = Get-ScheduledTask -TaskPath '\' -TaskName $taskName
            $commands = Get-CheckerCommands $sender.Tag ([string]$task.State)
            if ($commands) {
                foreach ($command in $commands.Split(',')) {
                    switch ($command) {
                        Enable { Enable-ScheduledTask -InputObject $task | Out-Null }
                        Disable { Disable-ScheduledTask -InputObject $task | Out-Null }
                        Start { Start-ScheduledTask -TaskPath '\' -TaskName $taskName }
                    }
                }
            }
        } catch {
            [void][Windows.Forms.MessageBox]::Show($form, $_.Exception.Message, 'Checker action failed')
        }
        Update-Panel
    })
}
$timer = [Windows.Forms.Timer]@{ Interval = 3000 }
$timer.Add_Tick({ Update-Panel })
try {
    Update-Panel
    if ($SmokeTest) {
        $form.CreateControl()
        if ($buttons.Count -ne 3 -or $status.Text -eq 'Checker unavailable') {
            throw 'Panel could not read the scheduled task.'
        }
        Write-Output $status.Text
    } else {
        $timer.Start()
        [void]$form.ShowDialog()
    }
} finally {
    $timer.Dispose()
    $form.Dispose()
}
