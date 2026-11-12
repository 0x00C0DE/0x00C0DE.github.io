---
name: 0x00c0de-release
description: Apply the default branch, publish, and production verification workflow for implementation changes to 0x00C0DE/0x00C0DE.github.io only.
---

# Release changes to 0x00C0DE.github.io

Apply this workflow when the owner asks to implement changes in this repository. Confirm that the intended GitHub remote is `0x00C0DE/0x00C0DE.github.io`, regardless of the checkout's folder name. An explicit task instruction such as local-only, draft-only, or hold for review takes precedence. Read-only work has no release step.

1. Before editing, inspect the current diff and fetch the latest `origin/main`. Start a fresh feature branch from that revision using `US-<next-number>-<short-description>-v1`. Check existing local and remote branch names. Use an isolated worktree when the current checkout contains unrelated changes. Preserve work already in progress and include only changes authorized for this task.
2. Run the relevant repository checks, review the final diff, and commit the verified changes on the new branch.
3. Publish the feature branch and integrate that same change into `main` during the task. When direct fast-forward is allowed, push both refs atomically with `git push --atomic origin HEAD:refs/heads/<feature-branch> HEAD:refs/heads/main`. If GitHub requires a pull request or approvals, use that protected path and wait for the required checks. If `main` advances, integrate its changes on the feature branch and rerun relevant checks before retrying. Preserve branch protections and remote history.
4. Follow the repository's documented release order for the affected production components. For Pages changes, wait for the deployment of the integrated revision and verify the changed public route or asset. For Worker changes, use the documented Cloudflare release steps and verify the deployed version and relevant endpoint. Verify other services only when the change affects a documented production target.
5. Report the feature branch, integrated revision, and production verification. If permissions, approvals, failing checks, or an unavailable deployment target prevent completion, report the exact blocker and the last verified state. A local commit or a pushed feature branch alone is an incomplete release.

The owner's standing release instruction covers normal publication and deployment of verified changes they request for this repository. It does not authorize work in other repositories, unrelated changes, or bypassing required platform permissions.
