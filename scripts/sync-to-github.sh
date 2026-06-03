#!/bin/bash
# Auto-sync Replit changes to GitHub after every Replit commit.
# Runs as part of the postMerge hook defined in .replit.
#
# Required secrets/env vars:
#   GITHUB_TOKEN  — Personal Access Token with repo write access
#   GITHUB_REPO   — Full HTTPS repo URL, e.g. https://github.com/user/repo.git

set -euo pipefail

if [ -z "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]; then
  echo "[sync-to-github] GITHUB_PERSONAL_ACCESS_TOKEN is not set — skipping GitHub sync."
  exit 0
fi
GITHUB_TOKEN="$GITHUB_PERSONAL_ACCESS_TOKEN"

if [ -z "${GITHUB_REPO:-}" ]; then
  echo "[sync-to-github] GITHUB_REPO is not set — skipping GitHub sync."
  exit 0
fi

# Build an authenticated remote URL (token embedded so no interactive prompt).
# Strip any existing credentials from the URL first for safety.
CLEAN_URL=$(echo "$GITHUB_REPO" | sed 's|https://[^@]*@||')
AUTH_URL="https://x-access-token:${GITHUB_TOKEN}@${CLEAN_URL#https://}"

REMOTE_NAME="github-sync"

# Register (or update) the remote.
if git remote get-url "$REMOTE_NAME" &>/dev/null; then
  git remote set-url "$REMOTE_NAME" "$AUTH_URL"
else
  git remote add "$REMOTE_NAME" "$AUTH_URL"
fi

# Determine which branch to push.
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")

echo "[sync-to-github] Pushing branch '$BRANCH' to GitHub..."
git push "$REMOTE_NAME" "${BRANCH}:main" --force 2>&1 \
  | sed "s|${GITHUB_TOKEN}|***|g" || {
    echo "[sync-to-github] Push failed — check GITHUB_TOKEN permissions and GITHUB_REPO value."
    exit 1
  }

echo "[sync-to-github] Done."
