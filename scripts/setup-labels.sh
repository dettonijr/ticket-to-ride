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

for spec in "${labels[@]}"; do
  IFS='|' read -r name color desc <<<"$spec"
  gh label create "$name" --repo "$repo" --color "$color" --description "$desc" --force
  echo "ok: $name"
done
