# Release workflow

These instructions apply to the 0x00C0DE.github.io repository. An explicit instruction for the current task takes precedence.

For each new change, start from the latest `origin/main` on a new feature branch named `US-<next-number>-<short-description>-v1`. Keep unrelated working changes out of the branch. After verifying the change, commit it, push the feature branch, and fast-forward `origin/main` from that branch in the same task. An atomic push can publish both refs together. If `main` has advanced, integrate its updates and recheck the change before retrying. Preserve branch protections and remote history.

For site changes, verify that GitHub Pages serves the updated route or assets and report the deployment status.
