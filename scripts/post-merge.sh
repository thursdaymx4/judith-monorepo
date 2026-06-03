#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push

# Auto-sync to GitHub (non-fatal — GitHub sync failure won't break the merge).
bash "$(dirname "$0")/sync-to-github.sh" || true
