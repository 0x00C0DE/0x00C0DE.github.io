function Remove-ResearchWorktree([string]$Worktree, [string]$BatchDirectory) {
    try {
        $resolved = (Resolve-Path -LiteralPath $Worktree).Path
        $expectedParent = (Resolve-Path -LiteralPath $BatchDirectory).Path
        if ((Split-Path -Parent $resolved) -ne $expectedParent) {
            throw 'Worktree is outside the batch directory.'
        }
        Invoke-Checked git -c core.longpaths=true worktree remove -- $resolved
    } catch {
        Write-Warning "Could not clean up feature worktree $Worktree. The batch will continue. $($_.Exception.Message)"
    }
}
