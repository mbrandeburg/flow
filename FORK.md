# Fork Management Guide

## Overview

This guide explains how to maintain your fork of Flow, keep custom configurations, sync updates from upstream, and push to your own container registry.

## Initial Fork Setup

### 1. Fork the Repository on GitHub

1. Go to https://github.com/pacexy/flow
2. Click "Fork" in the top right
3. Choose your account as the destination
4. The fork will be created at `https://github.com/YOUR_USERNAME/flow`

### 2. Clone Your Fork Locally

```bash
# If you haven't cloned yet
cd ~/dmc/tests
git clone https://github.com/YOUR_USERNAME/flow.git
cd flow

# If you already have the original repo cloned
cd /Users/matthewbrandeburg/dmc/tests/flow
git remote rename origin upstream
git remote add origin https://github.com/YOUR_USERNAME/flow.git
git fetch origin
```

### 3. Set Up Upstream Remote

This allows you to pull updates from the original repository:

```bash
# Add upstream remote (the original pacexy/flow repo)
git remote add upstream https://github.com/pacexy/flow.git

# Verify remotes
git remote -v
# Should show:
# origin    https://github.com/YOUR_USERNAME/flow.git (fetch)
# origin    https://github.com/YOUR_USERNAME/flow.git (push)
# upstream  https://github.com/pacexy/flow.git (fetch)
# upstream  https://github.com/pacexy/flow.git (push)
```

## File Organization Strategy

### Files to Keep in Your Fork

These are customizations specific to your deployment:

```
.github/workflows/release.yml  # Your custom CI/CD
k8s/                           # Your Kubernetes configs
  ├── configmap.yaml          # Your domain & settings
  ├── secret.yaml             # Your secrets
  ├── deployment.yaml         # Your registry image
  ├── service.yaml            # LoadBalancer on port 3005
  └── pvc.yaml                # Your storage config
apps/reader/.env.local         # Your local dev config
apps/website/.env.local        # Your local dev config
DEPLOYMENT.md                  # Your deployment docs
RELEASE.md                     # Your release docs
FORK.md                        # This file
```

### Files to Exclude from Version Control

Add to `.gitignore` to prevent committing sensitive data:

```bash
# Add these to .gitignore if not already there
apps/*/.env.local
.env
.env.local
```

**Note:** The configuration files in `k8s/` should be committed but without sensitive values. Actual secrets go in Kubernetes, not in git.

## Workflow: Keeping Your Fork Updated

### Option A: Merge Upstream Changes (Recommended)

This preserves your commit history and custom changes:

```bash
# 1. Fetch latest from upstream
git fetch upstream

# 2. Checkout your main branch
git checkout main

# 3. Merge upstream changes
git merge upstream/main

# 4. Resolve any conflicts (see below)
# Edit conflicting files, then:
git add .
git commit -m "Merge upstream changes"

# 5. Push to your fork
git push origin main
```

### Option B: Rebase on Upstream (Clean History)

This rewrites history to make it linear:

```bash
# 1. Fetch latest from upstream
git fetch upstream

# 2. Rebase your changes on top of upstream
git rebase upstream/main

# 3. Resolve conflicts if any
# Edit files, then:
git add .
git rebase --continue

# 4. Force push to your fork (rewrites history)
git push origin main --force-with-lease
```

### Recommended Workflow

**For most users:** Use **Option A (Merge)** - it's safer and preserves history.

```bash
# Regular sync routine (weekly/monthly)
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

## Handling Conflicts

When syncing from upstream, you might get conflicts in your custom files.

### Common Conflict Scenarios

#### 1. Dockerfile Conflicts

If upstream updates `Dockerfile`:

```bash
# During merge, you'll see:
# CONFLICT (content): Merge conflict in Dockerfile

# Open Dockerfile and look for conflict markers:
# <<<<<<< HEAD
# Your changes
# =======
# Upstream changes
# >>>>>>> upstream/main

# Keep upstream base but preserve your Node 18 upgrade
# Manually edit to combine both, then:
git add Dockerfile
git commit
```

#### 2. Package.json Conflicts

```bash
# Usually safe to take upstream version
git checkout upstream/main -- package.json
git add package.json

# Then reinstall dependencies
pnpm install
```

#### 3. Your Custom Files

Your custom files (`k8s/*`, `DEPLOYMENT.md`, `RELEASE.md`) won't conflict because they don't exist upstream.

### Conflict Resolution Strategy

1. **Take upstream version** for core app files (src/, components/, etc.)
2. **Keep your version** for deployment configs (k8s/, .github/workflows/)
3. **Merge carefully** for Dockerfile, docker-compose.yml
4. **Test after merging** with `pnpm dev` before deploying

## Protecting Your Custom Configurations

### Strategy 1: Separate Configuration Branch (Advanced)

Keep your configs on a separate branch:

```bash
# Create a config branch
git checkout -b config
git add k8s/ .github/workflows/release.yml DEPLOYMENT.md RELEASE.md FORK.md
git commit -m "Custom deployment configuration"
git push origin config

# Regular workflow:
# 1. Sync main with upstream (gets latest app code)
git checkout main
git merge upstream/main
git push origin main

# 2. Merge main into config (apply app updates to your config)
git checkout config
git merge main
# Resolve conflicts favoring your config files
git push origin config

# 3. Deploy from config branch
git checkout config
# Build and deploy
```

### Strategy 2: Keep Custom Files Only (Simple)

Keep all custom files on main branch, handle conflicts manually when they arise:

```bash
# This is what you're doing now - it's simpler and works well
git checkout main
git merge upstream/main
# Resolve conflicts favoring your deployment configs
git push origin main
```

**Recommendation:** Use **Strategy 2** (simple) unless you have many custom changes.

## GitHub Actions & Container Registry

### Your Fork's Registry URL

When you fork, your images will be published to:
```
ghcr.io/YOUR_USERNAME/flow:latest
```

### Update Deployment to Use Your Registry

Already done in `k8s/deployment.yaml`:
```yaml
image: ghcr.io/YOUR_USERNAME/flow:latest
```

Replace `YOUR_USERNAME` with your actual GitHub username.

### Enable GitHub Container Registry

1. Go to your fork on GitHub
2. Go to Settings → Actions → General
3. Scroll to "Workflow permissions"
4. Select "Read and write permissions"
5. Click "Save"

### Trigger a Build

```bash
# Option 1: Push to main (auto-builds)
git push origin main

# Option 2: Create a version tag
git tag v1.0.0
git push origin v1.0.0

# Option 3: Manual trigger
# Go to GitHub → Actions → Build and Push Docker Image → Run workflow
```

### Make Your Images Public

By default, GHCR images are private. To make them public:

1. Go to https://github.com/YOUR_USERNAME?tab=packages
2. Find "flow" package
3. Click on it → Package settings
4. Scroll to "Danger Zone"
5. Click "Change visibility" → Public

## Development Workflow

### Local Development

```bash
# 1. Start development server
pnpm dev

# 2. Make changes to app code
# Edit files in apps/reader/src/, etc.

# 3. Test locally
# Open http://localhost:7127
```

### Before Deploying

```bash
# 1. Build locally to test
pnpm build

# 2. Test Docker build
docker build -t test-flow .
docker run -p 3000:3000 test-flow

# 3. Commit and push
git add .
git commit -m "feat: your changes"
git push origin main

# 4. GitHub Actions will build and push to your registry
```

## Deployment Workflow

### 1. Update Image in Kubernetes

After GitHub Actions builds your image:

```bash
# Update deployment to pull latest image
kubectl rollout restart deployment/flow-reader

# Or if you tagged a specific version
kubectl set image deployment/flow-reader flow-reader=ghcr.io/YOUR_USERNAME/flow:v1.0.0
```

### 2. Apply Configuration Changes

When you update `k8s/` files:

```bash
# Apply all configs
kubectl apply -f k8s/

# Or apply specific file
kubectl apply -f k8s/configmap.yaml
kubectl rollout restart deployment/flow-reader
```

## Keeping Custom Files Separate from Upstream

### .gitignore Strategy

Create a `.git/info/exclude` file for local-only ignores:

```bash
# Edit .git/info/exclude
echo "apps/*/.env.local" >> .git/info/exclude
echo ".env.local" >> .git/info/exclude
```

This prevents accidentally committing local env files.

### Configuration Template Pattern

Keep templates in git, actual values in Kubernetes:

```yaml
# k8s/secret.yaml (committed to git)
apiVersion: v1
kind: Secret
metadata:
  name: flow-reader-secrets
stringData:
  # Add your secrets in Kubernetes, not here
  # This file is just a template
```

Apply actual secrets directly to cluster:

```bash
kubectl create secret generic flow-reader-secrets \
  --from-literal=SENTRY_DSN="your-actual-dsn" \
  --dry-run=client -o yaml | kubectl apply -f -
```

## Summary: Your Complete Workflow

### Initial Setup (One Time)

```bash
# 1. Fork on GitHub
# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/flow.git
cd flow

# 3. Add upstream
git remote add upstream https://github.com/pacexy/flow.git

# 4. Update k8s/deployment.yaml with your registry
# 5. Commit custom configs
git add .
git commit -m "feat: custom deployment configuration"
git push origin main

# 6. Enable GitHub Actions write permissions
# 7. Build and deploy
```

### Regular Updates (Monthly/Quarterly)

```bash
# 1. Sync from upstream
git fetch upstream
git checkout main
git merge upstream/main

# 2. Resolve conflicts (favor upstream for app code, your configs for k8s/)
# 3. Test locally
pnpm install
pnpm build
pnpm dev

# 4. Push to your fork (triggers build)
git push origin main

# 5. Update Kubernetes
kubectl rollout restart deployment/flow-reader
```

### Making Your Own Changes

```bash
# 1. Create a branch
git checkout -b feature/my-change

# 2. Make changes
# Edit files...

# 3. Test
pnpm dev

# 4. Commit and push
git add .
git commit -m "feat: my awesome feature"
git push origin feature/my-change

# 5. Merge to main
git checkout main
git merge feature/my-change
git push origin main

# 6. Deploy
# GitHub Actions builds automatically
# Then update Kubernetes
```

## Data Persistence

### What's Stored in PVC

The PersistentVolumeClaim at `/app/data` will store:
- User uploaded ePub files
- Reading progress
- Highlights and annotations
- App state/database (Dexie/IndexedDB data persisted to disk)

### Backup Your Data

```bash
# Get pod name
POD=$(kubectl get pod -l app=flow-reader -o jsonpath="{.items[0].metadata.name}")

# Backup data
kubectl exec $POD -- tar czf - /app/data > flow-backup-$(date +%Y%m%d).tar.gz

# Store backup safely
mv flow-backup-*.tar.gz ~/backups/
```

### Restore Data

```bash
# Upload backup to pod
kubectl exec -i $POD -- tar xzf - -C / < flow-backup-20250115.tar.gz

# Restart
kubectl rollout restart deployment/flow-reader
```

## Troubleshooting

### "Image pull" Errors

```bash
# Make your GHCR package public (see above) OR create image pull secret
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=YOUR_USERNAME \
  --docker-password=YOUR_GITHUB_PAT

# Update k8s/deployment.yaml to use secret (uncomment imagePullSecrets)
```

### Merge Conflicts Every Time

If you keep getting the same conflicts:

```bash
# Tell git to remember your conflict resolutions
git config rerere.enabled true

# Git will auto-apply previous conflict resolutions
```

### Lost Your Custom Changes

```bash
# View your commit history
git log --oneline

# Find your commits and cherry-pick them
git cherry-pick <commit-hash>
```

## Quick Reference

```bash
# Sync from upstream
git fetch upstream && git merge upstream/main

# Push to your fork
git push origin main

# Deploy latest
kubectl rollout restart deployment/flow-reader

# View logs
kubectl logs -l app=flow-reader -f

# Update config
kubectl apply -f k8s/configmap.yaml
kubectl rollout restart deployment/flow-reader
```

## Next Steps

1. **Fork the repository** on GitHub
2. **Update k8s/deployment.yaml** with your GitHub username
3. **Push to your fork** to trigger first build
4. **Deploy to your Raspberry Pi** K8s cluster
5. **Set up regular sync** from upstream (monthly)
