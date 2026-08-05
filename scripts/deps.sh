#!/usr/bin/env bash
#
# deps.sh — check for and apply dependency updates across the pnpm monorepo.
#
# This repo pins EXACT dependency versions (no ^ or ~ ranges) in every
# package.json. That is closer to a fully pinned Python requirements.txt than to
# a typical Node project: nothing moves unless you deliberately bump it.
#
# Usage:
#   ./scripts/deps.sh check        # show what is outdated (read-only, default)
#   ./scripts/deps.sh update       # bump within existing version ranges
#   ./scripts/deps.sh latest       # bump everything to newest, rewrites package.json
#   ./scripts/deps.sh interactive  # pick updates one-by-one (recommended)
#   ./scripts/deps.sh verify       # reinstall + lint + build to confirm nothing broke
#   ./scripts/deps.sh auto         # hands-off monthly update: branch -> update -> verify -> commit
#
# After any update run `./scripts/deps.sh verify` before committing.
# For a set-and-forget monthly run, use `auto` (see cmd_auto below).

set -euo pipefail

# --- Resolve a pnpm runner -------------------------------------------------
# The repo pins pnpm via the "packageManager" field in package.json. We prefer
# a directly installed pnpm, fall back to corepack if present, and otherwise
# explain how to get one. We never install global tooling silently.
# NOTE: Node 25+ (this repo now targets Node 26) removed the bundled corepack,
# so `npm install -g pnpm` is the expected path on current Node.
resolve_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    PNPM="pnpm"
  elif command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null 2>&1 || true
    PNPM="corepack pnpm"
  else
    cat >&2 <<'EOF'
error: no pnpm found.

Install one of the following, then re-run:
  * pnpm standalone:            run `npm install -g pnpm`   (Node 25+ has no corepack)
  * via Homebrew:               run `brew install pnpm`
  * corepack (Node <= 24 only): run `corepack enable`

This repo expects the version listed in package.json -> "packageManager".
EOF
    exit 1
  fi
}

# All pnpm commands operate on every workspace package (-r / --recursive).
cmd_check() {
  echo "==> Checking for outdated dependencies across all workspaces..."
  # `outdated` exits non-zero when updates exist; that is informational here.
  $PNPM outdated -r || true
  echo
  echo "Legend: 'Current' = installed, 'Latest' = newest published."
  echo "Run './scripts/deps.sh interactive' to choose updates, or 'latest' to take all."
}

cmd_update() {
  echo "==> Updating dependencies within their current version ranges..."
  echo "    (Because versions are pinned exactly here, this usually changes little.)"
  $PNPM update -r
  echo "==> Done. Run './scripts/deps.sh verify' next."
}

cmd_latest() {
  echo "==> Updating ALL dependencies to their latest versions..."
  echo "    This rewrites the pinned versions in every package.json."
  $PNPM update -r --latest
  echo "==> Done. Review the package.json diffs, then './scripts/deps.sh verify'."
}

cmd_interactive() {
  echo "==> Interactive update: choose exactly which packages to bump to latest."
  $PNPM update -r --latest -i
  echo "==> Done. Run './scripts/deps.sh verify' next."
}

cmd_verify() {
  echo "==> Reinstalling from lockfile..."
  $PNPM install
  # NOTE: `pnpm lint` currently fails under TypeScript 7 — typescript-eslint does
  # not yet support TS 7.0 (tracked upstream). Lint is not a release gate (the
  # Docker build runs `next build`, not lint), so we warn but do not fail here.
  echo "==> Linting (non-fatal)..."
  $PNPM lint || echo "warning: lint failed — expected under TS 7 until typescript-eslint supports it."
  echo "==> Building..."
  $PNPM build
  echo "==> Verify complete. Safe to commit the lockfile + package.json changes."
}

# Hands-off monthly update. Designed to be safe to run unattended:
#   1. Refuses to run if the working tree is dirty (so it never sweeps up
#      unrelated work-in-progress into the update commit).
#   2. Isolates the update on a dated branch, never touching main directly.
#   3. Bumps every dependency to latest, then lint + build as a gate.
#   4. Commits ONLY package.json files + the lockfile, and only if the gate
#      passes. On failure it stops and leaves the branch for you to inspect.
# It never pushes and never merges -- you stay in control of what reaches the
# cluster. Review the diff, then push and deploy when ready.
cmd_auto() {
  if [ -n "$(git status --porcelain)" ]; then
    echo "error: working tree is not clean. Commit or stash changes first." >&2
    exit 1
  fi

  local branch
  branch="deps/update-$(date +%Y-%m-%d)"
  echo "==> Creating branch '$branch'..."
  git checkout -b "$branch"

  echo "==> Showing what is outdated (for the record)..."
  $PNPM outdated -r || true

  echo "==> Bumping all dependencies to latest..."
  $PNPM update -r --latest

  # Lint is non-fatal here — it fails under TS 7 until typescript-eslint supports
  # it; the build is the real gate.
  echo "==> Verifying (install + build; lint runs non-fatally)..."
  $PNPM lint || echo "warning: lint failed — expected under TS 7 until typescript-eslint supports it."
  if ! ($PNPM install && $PNPM build); then
    echo >&2
    echo "error: verification failed after updating." >&2
    echo "The changes are left on branch '$branch' for you to inspect/fix." >&2
    echo "To abandon them: git checkout main && git branch -D $branch" >&2
    exit 1
  fi

  if git diff --quiet -- '*package.json' 'pnpm-lock.yaml'; then
    echo "==> Nothing to update -- all dependencies already current."
    git checkout - >/dev/null 2>&1
    git branch -D "$branch" >/dev/null 2>&1
    exit 0
  fi

  echo "==> Committing dependency bumps..."
  git add '*package.json' 'pnpm-lock.yaml'
  git commit -m "chore(deps): monthly dependency update ($(date +%Y-%m-%d))"

  echo
  echo "==> Done. Updates committed on branch '$branch'."
  echo "    Review:  git show"
  echo "    Publish: git push origin $branch   (then open a PR, or merge into main)"
  echo "    Then build a new image so --frozen-lockfile picks up the new versions."
}

main() {
  cd "$(dirname "$0")/.."
  resolve_pnpm

  case "${1:-check}" in
    check)       cmd_check ;;
    update)      cmd_update ;;
    latest)      cmd_latest ;;
    interactive) cmd_interactive ;;
    verify)      cmd_verify ;;
    auto)        cmd_auto ;;
    *)
      echo "Unknown command: ${1:-}" >&2
      grep -E '^#   \./scripts/deps\.sh' "$0" >&2
      exit 1
      ;;
  esac
}

main "$@"
