#!/usr/bin/env bash
# Creates the triage labels listed in docs/agents/triage-labels.md.
# Safe to re-run: existing labels are updated in place.
#
# Requires the gh CLI authenticated with write access to the repo.
# Usage: ./scripts/setup-labels.sh [owner/repo]
set -euo pipefail

repo="${1:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"

labels=(
  "needs-triage|e99695|Maintainer needs to evaluate this issue"
  "needs-info|fbca04|Waiting on reporter for more information"
  "ready-for-agent|0e8a16|Fully specified, ready for an AFK agent"
  "ready-for-human|1d76db|Requires human implementation"
  "wontfix|ffffff|Will not be actioned"
)

# Uses the REST API rather than `gh label create`, which needs GraphQL and is
# unavailable in some hosted sessions.
for spec in "${labels[@]}"; do
  IFS='|' read -r name color desc <<<"$spec"
  if gh api "repos/$repo/labels/$name" >/dev/null 2>&1; then
    gh api --method PATCH "repos/$repo/labels/$name" -f color="$color" -f description="$desc" >/dev/null
    echo "updated: $name"
  else
    gh api --method POST "repos/$repo/labels" -f name="$name" -f color="$color" -f description="$desc" >/dev/null
    echo "created: $name"
  fi
done
