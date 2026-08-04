#!/usr/bin/env bash
#
# verify-node18.sh — build the reader in Docker on the production-parity Node.
#
# Why: the host runs Node 26, which can't run this repo's Next build worker.
# This script builds on the same Node the production Dockerfile pins (Node 20,
# required by Next 16) WITHOUT rebuilding the whole image each time:
#   * node_modules live in named Docker volumes (Linux-native, isolated from the
#     macOS node_modules on the host, and cached between runs).
#   * the pnpm content-addressable store is cached in its own volume, so only
#     changed packages download after a dependency bump.
#
# Usage:
#   ./scripts/verify-node18.sh            # install + build reader
#   ./scripts/verify-node18.sh lint       # install + lint reader
#   ./scripts/verify-node18.sh clean      # remove the cached volumes

set -euo pipefail
cd "$(dirname "$0")/.."

PNPM_VER="10.6.4"
IMAGE="node:20-alpine"

# Named volumes keep Linux node_modules separate from the host's macOS ones.
NM_VOLS=(
  "-v flow-store:/root/.local/share/pnpm/store"
  "-v flow-nm-root:/app/node_modules"
  "-v flow-nm-reader:/app/apps/reader/node_modules"
  "-v flow-nm-website:/app/apps/website/node_modules"
  "-v flow-nm-internal:/app/packages/internal/node_modules"
  "-v flow-nm-tailwind:/app/packages/tailwind/node_modules"
  "-v flow-nm-epubjs:/app/packages/epubjs/node_modules"
)

if [ "${1:-build}" = "clean" ]; then
  docker volume rm -f flow-store flow-nm-root flow-nm-reader flow-nm-website \
    flow-nm-internal flow-nm-tailwind flow-nm-epubjs
  echo "==> Cleaned cached volumes."
  exit 0
fi

TASK="build"
[ "${1:-}" = "lint" ] && TASK="lint"

echo "==> Running reader $TASK on $IMAGE (production-parity Node)..."
# shellcheck disable=SC2068
docker run --rm \
  -v "$PWD":/app -w /app \
  ${NM_VOLS[@]} \
  "$IMAGE" sh -c "
    corepack enable &&
    corepack prepare pnpm@${PNPM_VER} --activate &&
    pnpm install &&
    pnpm -F reader ${TASK}
  "
