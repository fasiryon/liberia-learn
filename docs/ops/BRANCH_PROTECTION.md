# Branch Protection for `main`

Manual GitHub configuration is required for the `main` branch.

## Configure the Rule

1. Open GitHub repository settings.
2. Go to `Settings` -> `Branches`.
3. Create or edit the branch protection rule for `main`.

## Required Settings

- Require status checks to pass before merging
- Require branches to be up to date before merging
- Require pull request reviews before merging
- Do not allow bypassing the above settings

## Required Checks

- `CI / build`
- `Runtime Gate 1 / runtime-gate`

For a solo maintainer, pull request review requirements can remain enabled and handled through the repository's normal exception policy only if that policy explicitly permits it. Status checks should remain mandatory.
