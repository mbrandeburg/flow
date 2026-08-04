# Framework Migration — Resume Notes

**Last updated:** 2026-08-04
**Branch with WIP:** `framework-migration` (based on `main`)
**Deployable branch:** `main` (untouched by the risky migration)

---

## TL;DR — where we are

We are modernizing the **Flow ePub reader** fork (`mbrandeburg/flow`) to "2026" dependencies.
Tooling majors, the recoil→valtio migration, and the **Node 18 → Node 20 base image**
bump are **DONE, committed, and pushed to `main`**. The big **Next 12 → 16 / React 18 → 19**
framework migration is **in progress on the `framework-migration` branch** — all the
package.json + config edits are made and **committed**, but the migration **has not been
installed/built successfully yet** because the machine ran out of disk (`ERR_PNPM_ENOSPC`)
mid-install.

**Next action after reboot:** with freed disk, run the Next 16 build (see
"How to resume" below), then fix the type errors that surface.

---

## Repo facts (quick reference)

- **Monorepo:** pnpm 10.6.4 + Turborepo. Workspaces: `@flow/reader` (Next.js reader, port 7127),
  `@flow/website` (7117), `@flow/epubjs` (vendored engine), `@flow/internal`, `@flow/tailwind`,
  `@flow/monorepo` (root).
- **Version pinning:** EXACT versions only (no `^`/`~`), like a fully-pinned requirements.txt.
- **Host:** macOS, Node v26.6.0 (CANNOT build Next locally — use Docker). pnpm global at `/usr/local/bin/pnpm`.
- **Production image:** `Dockerfile` (3 stages, builder/installer/runner). Now `node:20-alpine`.
- **Deploy target:** k8s (manifests in `k8s/`). CI builds & pushes `ghcr.io/mbrandeburg/flow` (ARM64) via
  `.github/workflows/release.yml` on push to `main` / tags.
- **Git remotes:** `origin` = https://github.com/mbrandeburg/flow.git (WRITABLE fork),
  `upstream` = https://github.com/pacexy/flow.git (PULL ONLY). `remote.pushDefault=origin`.
- **Overriding constraint:** *don't break the working k8s deployment.* That's why the framework
  migration lives on a branch and `main` stays green.

---

## The Docker build loop (how we validate — host Node 26 can't build)

Script: `scripts/verify-node18.sh` (name is legacy; it now uses **node:20-alpine**).
It builds the reader inside Docker with cached named volumes (`flow-store`, `flow-nm-*`) so
only changed packages re-download.

```bash
./scripts/verify-node18.sh build   # pnpm install + reader build (default)
./scripts/verify-node18.sh lint    # pnpm install + reader lint
./scripts/verify-node18.sh clean   # remove the flow-* cached volumes (~2GB)
```

A green build reaches `Compiled successfully` + `Generating static pages (25/25)`.

---

## DONE + committed + pushed to `main`

| Commit | What |
|--------|------|
| `a53bd48` | Tooling majors: prettier 3.9.6, turbo 2.10.8 (turbo.json `pipeline`→`tasks`), husky 9.1.7, lint-staged 17.3.0, rollup 4, tsup 8, esno 4, eslint-config-prettier 10. Build green. |
| `d772bab` | **Removed recoil** (React 19 blocker) → valtio atoms. New `apps/reader/src/atom.ts` (`atom()`/`persistedAtom()`). Rewrote `state.ts`, `useAction.ts`, `useMobile.ts`, `useTheme.ts`, `_app.tsx`, `Layout.tsx`, `Reader.tsx`, `.eslintrc.js`. Build green, −24kB. Runtime-validated on Node 18 dev. |
| `b6d8bf1` | **Base image node:18 → node:20-alpine** (all 3 Dockerfile stages + `verify-node18.sh`). Required for Next 16 (`engines.node >=20.9`). Current Next 12 stack builds green on Node 20. |

Earlier pushed commits: `cc8a2ea` (merge upstream), `2ac0417`, `ba15c97`, `35b85e5`, `a04d6e1`,
plus dexie 3→4, swr 2, use-local-storage-state 20, type-fest 5 (all validated).

### ⚠️ CI is currently RED on `main` but the BUILD SUCCEEDS
The `b6d8bf1` CI run **built and pushed the image successfully**
(`ghcr.io/mbrandeburg/flow:main-b6d8bf1` exists and is deployable). It only failed on the
**last** step, `actions/attest-build-provenance@v1`:

```
Error: Failed to get ID token: Unable to get ACTIONS_ID_TOKEN_REQUEST_URL env variable
```

**Cause:** the job `permissions:` block lacks `id-token: write` (and `attestations: write`).
**Fix (applied on `main` — see commit after this doc):** add those two permissions to
`.github/workflows/release.yml`.

---

## IN PROGRESS — `framework-migration` branch (committed, NOT yet built)

Strategy: get a **Next 16 + React 19 CORE build artifact first** (defer PWA + Sentry config,
temporarily relax the type/lint gates), prove the infra works, then fix types on cheap rebuilds.

### Edits already made & committed on the branch

**`apps/reader/package.json`**
- `next` 12.3.4 → **16.3.0**
- `@next/bundle-analyzer` 12.1.6 → **16.3.0**
- `@sentry/nextjs` 7.12.1 → **10.69.0**
- `react` / `react-dom` 18.0.0 → **19.2.8**
- `react-icons` 4.3.1 → **5.7.0**
- `@types/node` 17.0.22 → **20.19.43**
- `@types/react` 17.0.43 → **19.2.18**
- **added** `@types/react-dom` **19.2.4**
- `tailwindcss` 3.2.0 → **3.4.19** (stayed on v3 — Tailwind 4 is a separate branch)
- **removed** `next-pwa`, `next-transpile-modules`, `@tailwindcss/line-clamp`
- `engines.node` → `>=20.9.0`

**`apps/reader/tailwind.config.js`** — dropped `@tailwindcss/line-clamp` plugin (built into TW 3.4).

**`apps/reader/next.config.js`** — REWRITTEN for Next 16:
- `withBundleAnalyzer` only (dropped `withSentryConfig` + `withPWA` wrappers)
- `transpilePackages: ['@flow/internal','@flow/epubjs','@material/material-color-utilities']`
  (replaces the removed `next-transpile-modules`)
- kept `i18n` (Pages Router still supports it)
- `output: 'standalone'` + `outputFileTracingRoot` moved to **top-level** (out of `experimental`)
- **TEMPORARY gates:** `eslint.ignoreDuringBuilds: true` + `typescript.ignoreBuildErrors: true`
  (marked with `TODO(framework-migration)` — MUST be removed after types are fixed)

**`packages/tailwind/package.json`** — `tailwindcss` 3.2.0 → **3.4.19**.

**`package.json` (root)** — `typescript` 4.6.3 → **5.9.3** (kept TS on 5.x; TS 7.0.2 is a later
follow-up), `engines.node` → `>=20.9.0`. ESLint stack LEFT at eslint 8 / eslint-config-next 12
(deferred; build ignores ESLint via the temp gate).

**Sentry handling:** we KEPT `@sentry/nextjs@10` as a dep so `_app.tsx` (`ErrorBoundary`) and
`_error.js` (`captureUnderscoreErrorException`) keep importing/compiling. Without init there is no
telemetry, but the build passes. **VERIFY** `captureUnderscoreErrorException` still exists in v10 —
if removed, `_error.js` needs an edit (it's `.js`, not type-checked, so only a runtime concern).

### Why it hasn't built yet
`./scripts/verify-node18.sh build` was started but the host disk hit **`ERR_PNPM_ENOSPC`**
mid-download of the Next 16 / Sentry 10 / sharp packages. The install never finished, so
**`pnpm-lock.yaml` is unchanged** (still the old resolution). No corruption.

---

## How to resume (after reboot / disk freed)

1. **Check disk:** `df -h /System/Volumes/Data` — need comfortably more than ~1.5GB free for the
   Next 16 install (Next + Sentry 10 + sharp + react-icons 5 pull a lot).
2. **Get on the branch:** `git checkout framework-migration` (WIP is already committed here).
3. **Run the build:** `./scripts/verify-node18.sh build`
   - This will `pnpm install` (updates `pnpm-lock.yaml` to Next 16 resolution) then `next build`.
   - Next 16 defaults to **Turbopack**. There is **no custom Babel config**, so SWC/Turbopack
     should work. If Turbopack chokes on `standalone`/Pages Router, force webpack:
     `next build --webpack` (edit the reader `build` script temporarily).
4. **Expect it to compile** (types are ignored via the temp gate). Confirm `Compiled successfully`
   + `25/25` pages. Commit this as the first green Next 16 artifact.
5. **Then turn the gates back on** — remove `typescript.ignoreBuildErrors` and fix the type errors:

### Known type errors to fix (from prior analysis)
- **`@types/react` 19 breaks `React.FC` implicit children** — ~28 sites need `PropsWithChildren`
  (or explicit `children`). Files:
  `models/reader.ts`, `Tab`, `Reader`, `Layout`, `Row`, `Annotation`, `AnnotationView`,
  `ImageView`, `TimelineView`, `SearchView`, `TocView`, `TypographyView`, `ThemeView`,
  `TextSelectionMenu`, `Button`, `Page`, `settings`, `DropZone`, `SplitView`, `ActionBar`,
  `GridView`, `Form`, `index`, `_app` (+ website: `MDX`, `Seo`, `Layout`, `index`).
- **`react-icons` 5** returns `ReactNode` from `IconType`; fine with `@types/react` 19 (was the
  blocker on 18). Confirm no residual JSX-element errors.
- **valtio:** we kept **1.6.0** (works with React 19). Do NOT bump to valtio 2 here — v2's snapshot
  drops the hand-rolled `AsRef` brand (`models/reader.ts:77`), making every `ref()`'d object
  (iframe/rendition/book/…) `DeepReadonly` → mutation errors at `Reader.tsx:353` etc. Separate effort.

### Then re-enable the deferred pieces (each can be its own commit)
- **ESLint flat config:** eslint 8→10, eslint-config-next 12→16, `@typescript-eslint/*` 5→8.
  NOTE: `next lint` is **REMOVED in Next 16** — migrate the reader `lint` script to the ESLint CLI
  with a flat `eslint.config.js`. Then remove `eslint.ignoreDuringBuilds`.
  Also delete/replace the stale `apps/reader/.eslintrc.js` (CI logged
  `Failed to load config "../../.eslintrc.js"`).
- **Sentry v10 properly:** `withSentryConfig(nextConfig, options)` single-options signature +
  `instrumentation.ts` / `instrumentation-client.ts` (init moved out of
  `sentry.server.config.js` / `sentry.client.config.js`). Re-add the wrapper in `next.config.js`.
- **PWA:** swap `next-pwa` → `@ducanh2912/next-pwa` (10.2.9, peer `next>=14`) or `@serwist/next`.
  ⚠️ Both are **webpack**-based; under Next 16 Turbopack the SW hook may be ignored — verify, or
  build the reader with `--webpack` when PWA is required.
- **TypeScript 7.0.2** (the native/Go compiler) — bump after 5.9.3 is green.
- **Tailwind 3 → 4** — SEPARATE branch. Big CSS-first rewrite: `postcss.config.js` →
  `@tailwindcss/postcss`, drop `autoprefixer`, `styles.css` `@tailwind` → `@import "tailwindcss"`,
  `darkMode`, and the custom `packages/tailwind` preset (colors.js uses the old
  `({ opacityValue }) => …` closure-color signature that v4 removed → rework to `<alpha-value>`).

### Deferred (low k8s value)
- `apps/website`: next 12→16, @mdx-js 2→3, shiki 0.10→4, next-translate 1→3 (needs next13+).
- `packages/epubjs` tooling: webpack 4→5, babel 7→8, karma, mocha, jsdoc, documentation.

---

## Confirmed latest versions (as of 2026-08-04)

```
next                 16.3.0   (engines.node >=20.9.0)
react / react-dom    19.2.8
@types/react         19.2.18
@types/react-dom     19.2.4
@types/node (v20)    20.19.43
@sentry/nextjs       10.69.0
@next/bundle-analyzer 16.3.0
react-icons          5.7.0
tailwindcss (v3)     3.4.19
typescript           7.0.2   (using 5.9.3 for now)
@ducanh2912/next-pwa 10.2.9  (peer next>=14, webpack>=5.9)
eslint-config-next   16.3.0
```

---

## Disk & cleanup (done this session before reboot)

Host `/System/Volumes/Data` was ~100% full (~1.1GB free when we stopped). To reclaim space we ran:
- `./scripts/verify-node18.sh clean` — removed `flow-store` + `flow-nm-*` volumes (~2GB, incl. the
  partial Next 16 download).
- `docker rmi node:18-alpine node:20-alpine` — re-pullable (~50MB each).
- `docker builder prune -f` + `docker system prune -f` (**NOT** `-a`).

**DO NOT REMOVE** `gcr.io/k8s-minikube/kicbase` (~1.37GB) — it's minikube's base image; removing it
breaks the user's local cluster. That's why we avoided `docker system prune -a`.

After reboot, `verify-node18.sh build` re-pulls node:20-alpine and re-populates the volumes on first run.

---

## Session memory
Full running notes live at `/memories/session/deps-catchup.md` (SESSION 3 section mirrors this).
