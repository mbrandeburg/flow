# Flow Modernization — Resume Notes

**Last updated:** 2026-08-05
**Working branch:** none — all work merged to `main` (green, CI-verified, deployed). No migration in progress.

---

## ✅ pnpm 11 + Dockerfile hygiene + dep cleanup — DONE & merged (2026-08-05)

Two branches shipped to `main` after the disk-full crash, both CI-green (native arm64) and deployed:

- **`docker-hygiene-pnpm11`** (merge `58ca882`): Dockerfile hygiene + **pnpm 10.6.4 → 11.20.0** +
  the pnpm 11 supply-chain config in `pnpm-workspace.yaml`.
- **`deps-2026-types-cleanup`** (merge `33ae731`): dropped unused `babel-loader` (reader + website;
  Next uses SWC, no babel config) and deprecated `@types/uuid` (`uuid@14` self-types); `@types/node`
  20.19.43 → **26.1.2** (align with Node 26 runtime); `@flow/internal` `@types/react` 17→**19.2.18** /
  `@types/react-dom` 18→**19.2.4** (was skewed vs the React 19 reader). Both branches deleted post-merge.

### ⚠️ pnpm 11 gotchas (keep — these bit us and will recur on the monthly update flow)
Config lives in **`pnpm-workspace.yaml`** (pnpm 11 reads settings there, NOT `.npmrc` — only auth/registry).
1. **`minimumReleaseAge` cooldown**: pnpm 11 defaults it to `1440` min (1 day) and REFUSES to install
   versions younger than that — frozen lockfile included. Fresh pins (e.g. `shiki`/`@shikijs/*` published
   same day) get rejected. Fix in place: kept the cooldown + `minimumReleaseAgeExclude: [shiki, '@shikijs/*']`.
   **On future bumps to a same-day release, add it to that exclude list.**
2. **`ERR_PNPM_IGNORED_BUILDS` is now FATAL** (pnpm 10 only warned) — `pnpm i --frozen-lockfile` exits 1
   on any unreviewed dep build script, and it cascades into `pnpm -F reader build` (its `verifyDepsBeforeRun`
   runs install first). pnpm 11 **removed `ignoredBuiltDependencies`/`onlyBuiltDependencies`**; the replacement
   is the **`allowBuilds:` map** (`pkg: true|false`). In place: all 7 script-bearing deps set to `false`
   (`@sentry/cli, core-js, es5-ext, esbuild, next-translate-plugin, phantomjs-prebuilt, unrs-resolver`) — none
   needed by the SWC builds. NOTE: a *failed* install auto-injects a placeholder `allowBuilds` block at the TOP
   of `pnpm-workspace.yaml` ("set this to true or false") → "duplicated mapping key"; just delete the placeholder.
3. **The pnpm-10 lockfile did NOT need regenerating** — pnpm 11 accepts `9.0` as-is. The real blockers were 1 & 2.
4. **Host disk sink — `.pnpm-store`**: pnpm 11 writes its store to `<repo>/.pnpm-store` (gitignored) despite the
   `flow-store` volume mount — it reached **2.7 GB** (same disk-full vector as the crash). `rm -rf .pnpm-store`
   after Docker builds (regenerable). Keep only `flow-store` + one `flow-nm*` volume set. **Never**
   `docker system prune -a` or remove `gcr.io/k8s-minikube/kicbase`.

### Optional cleanup (not done — needs your ok)
Six stale *merged* feature branches still exist locally + on origin: `framework-migration`, `node-26-base`,
`tailwind-4-migration`, `typescript-7-upgrade`, `valtio-2-upgrade`, `website-next16-migration`. Safe to delete
(`git branch -d <b>` + `git push origin --delete <b>`) since they're all in `main`.

---

## TL;DR — where we are

The **Flow ePub reader** fork (`mbrandeburg/flow`) is fully modernized to "2026"
dependencies. Every major upgrade is **DONE, merged to `main`, CI-green, and
runtime-verified**:

- Tooling majors, **recoil → valtio**, **Node 18 → 20 → 26** base image
- Reader: **Next 12 → 16**, **React 18 → 19**, **Serwist PWA**, **ESLint 9 flat config**
- Reader: **Tailwind 3.4 → 4**
- Website: **Next 12 → 16** (MDX 3, next-translate 3, shiki 4)
- **TypeScript 5.9 → 7.0.2** (native/Go compiler)
- **valtio 1 → 2**

There is **no migration in progress**. Next work = normal product updates or the
small deferred items in "Known caveats & deferred work" below.

---

## Repo facts (quick reference)

- **Monorepo:** pnpm 11.20.0 + Turborepo. Workspaces: `@flow/reader` (Next.js reader, port 7127),
  `@flow/website` (7117), `@flow/epubjs` (vendored engine), `@flow/internal`, `@flow/tailwind`,
  `@flow/monorepo` (root).
- **Version pinning:** EXACT versions only (no `^`/`~`), like a fully-pinned requirements.txt.
- **Host:** macOS, Node v26.6.0 (CANNOT build Next locally — use Docker). pnpm global at `/usr/local/bin/pnpm`.
- **Production image:** `Dockerfile` (3 stages, builder/installer/runner). Now `node:26-alpine`.
- **Deploy target:** k8s (manifests in `k8s/`). CI builds & pushes `ghcr.io/mbrandeburg/flow` (ARM64) via
  `.github/workflows/release.yml` on push to `main` / tags.
- **Git remotes:** `origin` = https://github.com/mbrandeburg/flow.git (WRITABLE fork),
  `upstream` = https://github.com/pacexy/flow.git (PULL ONLY). `remote.pushDefault=origin`.
- **Overriding constraint:** *don't break the working k8s deployment.* Do risky changes on a
  branch, validate via CI dispatch, then merge to `main` so `main` stays green + deployable.

---

## How we build & validate (host Node 26 can't build Next)

The host has no repo `node_modules` (they live in Docker volumes), so **everything builds in
Docker on `node:26-alpine`** (production-parity linux/arm64), reusing cached named volumes
(`flow-store`, `flow-nm-*`) so only changed packages re-download. (Next 16 builds fine on
Node 26; the base image now tracks the host's Node 26.)

**Reader build/lint** — `scripts/verify-node18.sh` (legacy filename; pins `node:26-alpine`):

```bash
./scripts/verify-node18.sh build   # pnpm install + reader build
./scripts/verify-node18.sh lint    # pnpm install + reader lint (see TS7 caveat below)
./scripts/verify-node18.sh clean   # remove the flow-* cached volumes (~2GB)
```

**Website / arbitrary builds** — run a one-off container with the same volumes, e.g.
`pnpm -F website build` or `pnpm -F reader build`. Reader green = `Compiled successfully`
+ `Generating static pages (20/20)`; website green = `18/18` (MDX pages are `● SSG`).

**Dev server (for runtime checks)** — the host has no `node_modules` (they live in the
Docker volumes), so run dev in Docker with a port map, bind `0.0.0.0`, and pass `--webpack`
(both apps have a `webpack` config, so Turbopack errors without it):

```bash
docker run --rm -d --name flow-reader-dev -v "$PWD":/app -w /app \
  -v flow-store:/root/.local/share/pnpm/store -v flow-nm-root:/app/node_modules \
  -v flow-nm-reader:/app/apps/reader/node_modules -v flow-nm-website:/app/apps/website/node_modules \
  -v flow-nm-internal:/app/packages/internal/node_modules -v flow-nm-tailwind:/app/packages/tailwind/node_modules \
  -v flow-nm-epubjs:/app/packages/epubjs/node_modules -p 7127:7127 \
  node:26-alpine sh -c "npm install -g pnpm@11.20.0 && \
    pnpm -F reader exec next dev --webpack -p 7127 -H 0.0.0.0"   # website: -F website, port 7117
```

**CI validation of a branch (without touching deployables)** — CI (`release.yml`) only
triggers on push to `main`/tags, so validate a branch with a manual dispatch:

```bash
gh repo set-default mbrandeburg/flow            # once (repo has 2 remotes)
gh workflow run release.yml --ref <branch>      # tags image <branch> / <branch>-<sha>; NOT latest
gh run watch <run-id> --exit-status --interval 20
```

### ⚠️ Gotchas
- **Stale `tsconfig.tsbuildinfo`**: because the repo is mounted into the build container,
  incremental type-check can report **stale errors** after cross-file type changes. If local
  results look wrong, `rm -rf apps/reader/.next apps/reader/tsconfig.tsbuildinfo` and rebuild.
  CI (fresh container, clean install) is always authoritative.
- **`next-env.d.ts` churn**: `next dev` rewrites paths to `.next/dev/types/`; the committed
  build variant uses `.next/types/`. Discard the dev-mode change (`git checkout -- **/next-env.d.ts`).
- **Node 25+ removed corepack** — install pnpm with `npm install -g pnpm@11.20.0` (the Dockerfile
  and `verify-node18.sh` do this; corepack is gone on node:26-alpine).
- **Node 26 experimental `localStorage`**: build logs show `ExperimentalWarning: localStorage is
  not available…` during static generation — benign (the app detects server/client via `window`,
  not `localStorage`).
- **CI runs on a NATIVE arm64 runner** (`ubuntu-24.04-arm`), not QEMU. Node 26's newer V8
  crashes QEMU's arm64 emulation (`qemu: illegal instruction` during install) — building
  natively avoids it and is ~5× faster (~3 min vs ~16). `ubuntu-24.04-arm` = the runner OS
  (Ubuntu 24.04), unrelated to Node. GitHub's action runtime is Node 24 (GitHub's choice, not ours).
- **GitHub Actions are pinned to latest majors** (checkout v7, setup-buildx v4, login v4,
  metadata v6, build-push v7, attest-build-provenance v4) — clears the Node 20 / punycode notices.

---

## What's on `main` now (merge history)

| Merge / commit | What |
|--------|------|
| `866574b` | **Reader: Next 12→16 + React 18→19 + Serwist PWA + ESLint 9** flat config. Recoil→valtio, `@types/react` 19 fixes, react-icons 5, `tilg` removed (React 19 crash), next-pwa→`@serwist/next`, `next lint`→ESLint CLI. |
| `3a480e0` | **Reader: Tailwind 3.4 → 4.** `@tailwindcss/postcss` (dropped autoprefixer), `styles.css` `@import 'tailwindcss'` + `@config`, preset `colors.js` reworked from the removed `({opacityValue})=>` closure to `<alpha-value>`, dropped unused `@tailwindcss/aspect-ratio` + `container` block. |
| `2081ce8` | **Website: Next 12→16 + React 18→19** (MDX 3, next-translate 3 via `next-translate-plugin`, shiki 4). `next-transpile-modules`→`transpilePackages`, build/dev use `--webpack`. |
| `ef0a994` | **TypeScript 5.9.3 → 7.0.2** (native compiler). Root tsconfig: removed `baseUrl`, `moduleResolution` node→bundler, relative `paths`. |
| `8bc86f3` | **valtio 1.6.0 → 2.3.2.** New ref-brand handling in `models/reader.ts` (see caveats). |
| `1e4835f` | **Base image node:20 → node:26-alpine** (corepack gone in Node 25+ → `npm i -g pnpm`). **CI now runs on a native arm64 runner** (`ubuntu-24.04-arm`) instead of QEMU, and GitHub Actions bumped to latest majors. |
| `58ca882` | **pnpm 10.6.4 → 11.20.0 + Dockerfile hygiene.** JSON-form `CMD`, `ENV KEY=value`, `turbo prune` positional. pnpm 11 supply-chain config in `pnpm-workspace.yaml`: `minimumReleaseAge` cooldown + `shiki` exclude, `allowBuilds` (replaces removed `ignoredBuiltDependencies`). Lockfile `9.0` unchanged. |
| `33ae731` | **Dep cleanup.** Dropped unused `babel-loader` (reader + website) + deprecated `@types/uuid`; `@types/node` 20→26.1.2; `@flow/internal` `@types/react` 17→19 / `@types/react-dom` 18→19. |

Earlier base work (also on `main`): tooling majors (`a53bd48`), recoil→valtio (`d772bab`),
node:18→20-alpine (`b6d8bf1`), plus dexie 4 / swr 2 / use-local-storage-state 20 / type-fest 5.

**Deploy:** k8s (`k8s/`). CI (`release.yml`) builds & pushes `ghcr.io/mbrandeburg/flow`
(linux/arm64, Raspberry Pi) on push to `main`/tags. The Dockerfile builds **only the reader**
(`pnpm -F reader build`) — **no lint step**. The **website deploys separately via Netlify**
(`apps/website/netlify.toml`).

---

## Security posture (2026-08-05)

**Merged to `main` (`9d0359e`):**
- **Reader security headers** (`apps/reader/next.config.mjs` `headers()`): `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS, and a CSP subset
  (`frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'`).
- **k8s hardening** (`k8s/deployment.yaml`): `runAsNonRoot`/1001, drop `ALL` caps, `allowPrivilegeEscalation: false`,
  `readOnlyRootFilesystem: true` (+ `emptyDir` for `/tmp` and `.next/cache`), `seccompProfile: RuntimeDefault`,
  `automountServiceAccountToken: false`. Not auto-applied by CI — `kubectl apply` when ready and watch the rollout.
- **`cookie` CVE** (`pnpm-workspace.yaml` `overrides: cookie: '>=0.7.0'`, was <0.7.0 via `nookies`).

**Also merged:** Dropbox refresh-token cookie is now `httpOnly` + `sameSite=lax` (`933461d`) — it was
readable by client JS, so a malicious ePub's script in the render iframe could steal the 365-day token
→ account takeover. Added readable companion cookie `dropbox-connected` (`mapToConnected` in `sync.ts`)
for the UI + `POST /api/logout/[provider]` to clear the httpOnly cookie server-side. **Verify Dropbox
connect/disconnect/sync now that it's live.**

**Also merged — strict CSP for the reader (`6d94a2e`, Playwright-validated in a real browser):**
(`apps/reader/next.config.mjs`) `default-src 'self'`, tight `connect-src` (self + `blob:` + `*.dropboxapi.com`
only — caps where a compromised/ePub script can exfiltrate), `frame-src 'self' blob: data:`, `worker-src 'self'
blob:`, `object-src 'none'`, fonts allowlist. **`script-src`/`style-src` stay `'unsafe-inline'` on purpose:**
the reader is fully static (no `getServerSideProps` anywhere), so a per-request nonce can never reach the
build-time HTML — nonce CSP is architecturally impossible without converting to SSR. Browser test (prod image
in Docker + Playwright): app loads, `test.epub` renders in the epub.js iframe, TOC/chapter nav works, inline
scripts run, **0 CSP violations**. The one issue it caught — epub.js `fetch()`es the opened book as a `blob:`
URL → added `blob:` to `connect-src`. (The epub.js content iframe uses `allow-scripts allow-same-origin`; that
sandbox warning is inherent to epub.js, not the CSP.)

**Secrets OK:** `DROPBOX_CLIENT_SECRET` is server-only (no `NEXT_PUBLIC_`); `k8s/secret.yaml` has only commented placeholders.

**Verify live:** Dropbox connect/disconnect/sync (the httpOnly-cookie change) against your real Dropbox app.

**Recommended next (not done):**
- **Strict `script-src`** would require converting the reader to SSR (for nonces) or build-time hashing of
  the inline `_document.tsx` scripts — deferred; `connect-src` already limits the main exfiltration path.
- **Dockerfile**: pin the `node:26-alpine` base by digest (`@sha256:…`) + `apk upgrade --no-cache` for base-OS CVEs.
- **`@flow/epubjs` dev tooling** holds the 8 `critical`/61 `high` audit hits (webpack 4, handlebars, etc.) but is
  **not shipped** — built as source and stripped by Next standalone tracing. Upgrading (webpack 4→5, babel 7→8)
  clears the audit noise; low real risk, high churn.

---

## Known caveats & deferred work

### ⚠️ `pnpm lint` is broken under TypeScript 7
`typescript-eslint` (via `eslint-config-next`) declares peer `typescript >=4.8.4 <6.1.0` and
hard-refuses TS 7.0 — **no released version supports TS 7 yet** (tracked upstream:
typescript-eslint#10940, needs TS 7.1+). Build/type-check/CI are unaffected (the Dockerfile
runs `next build`, not lint). `scripts/deps.sh verify` / `auto` run lint **non-fatally** so the
monthly update flow isn't blocked. **When typescript-eslint ships TS 7 support, bump it and
`pnpm lint` works again** — nothing else to change.

### valtio 2 ref brand (in `apps/reader/src/models/reader.ts`)
valtio 2 renamed the snapshot ref brand `$$valtioRef` → `$$valtioSnapshot`
(`ref<T>(o): T & { $$valtioSnapshot: T }`; `Snapshot<T>` unwraps it, else `DeepReadonly`).
We replaced `AsRef` with `type Ref<T> = T & { $$valtioSnapshot: T }` and brand **only** the
ref'd fields whose snapshots are used mutably / are excessively deep: `iframe` (Window),
`rendition` (`RenditionWithManager`, assigned via `ref<RenditionWithManager>()`), and
`annotationRange` (Range). **Do NOT brand `section`/`sections`/`epub`/`_el`** — the brand
leaks into method default-param types (e.g. `searchInSection`) and breaks the build.

### `react-polymorphic-types` + bundler resolution
`react-polymorphic-types@2.0.0` has an `exports` map **without a `types` condition**, so TS 7's
`bundler`/`node16` resolution can't find its `index.d.ts`. Worked around with a `paths` entry in
root `tsconfig.json` → `./apps/reader/node_modules/react-polymorphic-types/index.d.ts` (it's a
reader-only, zero-runtime dep). Remove if the package publishes a fixed `exports`.

### Deferred (low value)
- **`packages/epubjs` tooling**: webpack 4→5, babel 7→8, karma, mocha, jsdoc, documentation.
  Not in the app build path (consumed as source via `transpilePackages`; built with babel, not tsc).
  Its `types/tsconfig.json` still uses `baseUrl` (would need updating if type-checked under TS 7).
- **TypeScript 7.1** (`next` dist-tag) once stable + typescript-eslint support lands.
- **Sentry**: `@sentry/nextjs@10` is a dep so `_app.tsx`/`_error.js` compile, but init is not wired
  (`instrumentation.ts` / `instrumentation-client.ts`) — no telemetry until that's added.

---

## Current pinned versions (on `main`, as of 2026-08-05)

Version pinning is **EXACT** (no `^`/`~`), like a fully-pinned requirements.txt.

```
node (Docker base)    26-alpine     (Node 25+ has no corepack; Dockerfile/verify use `npm i -g pnpm`)
next                  16.3.0        (reader + website; engines.node >=20.9.0)
react / react-dom     19.2.8
@types/react          19.2.18       (reader/website/internal — internal was 17, now aligned)
@types/react-dom      19.2.4        (internal was 18, now aligned)
@types/node           26.1.2        (aligned with the Node 26 runtime)
typescript            7.0.2         (native compiler; breaks pnpm lint — see caveats)
tailwindcss           4.3.3         (reader + packages/tailwind; website still on 3.2.0)
@tailwindcss/postcss  4.3.3
valtio                2.3.2
@sentry/nextjs        10.69.0
@serwist/next         9.5.12        (PWA; serwist 9.5.12)
react-icons           5.7.0
eslint                9.39.5        (flat config)
eslint-config-next    16.3.0
@mdx-js/loader/react  3.1.1         (website)
next-translate(+plugin) 3.2.0       (website)
shiki                 4.4.2         (website, via rehype-pretty-code 0.14.5)
pnpm                  11.20.0       turbo 2.10.8  (supply-chain gates configured in pnpm-workspace.yaml)
```

Removed as unused/deprecated: `babel-loader` (reader + website; Next uses SWC), `@types/uuid`
(`uuid@14` ships its own types).

Host: macOS, **Node v26.6.0** (same major as the Docker base). Build in Docker for
production-parity linux/arm64 + node_modules isolated from the host (which has no repo install).
Git remotes: `origin` = writable fork `mbrandeburg/flow`; `upstream` = pull-only `pacexy/flow`.

---

## Docker / disk notes

The `flow-*` volumes cache node_modules + the pnpm store (~2GB). If disk gets tight,
`./scripts/verify-node18.sh clean` removes them (re-populated on the next build).
`docker builder prune -f` + `docker system prune -f` are safe. **Do NOT run
`docker system prune -a`** or remove `gcr.io/k8s-minikube/kicbase` (~1.37GB) — that's
minikube's base image and removing it breaks the user's local cluster.

---

## Memory
Repo-scoped facts (build workflow, CI, migration status) are stored in agent memory at
`/memories/repo/flow-build-and-deps.md`.

