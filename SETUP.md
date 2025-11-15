# Your Personal Setup Summary

## Current Status ✅

You now have a complete deployment configuration for Flow on your Raspberry Pi Kubernetes cluster!

## What We've Configured

### Raspberry Pi Optimized
- ✅ **LoadBalancer** service on port **3005** (no ingress needed)
- ✅ **ARM64** Docker image builds
- ✅ **Single replica** deployment (suitable for Pi resources)
- ✅ **10Gi PVC** for all user data storage

### Your Domain
- ✅ Domain: **ebooks.matthewbrandeburg.com**
- ✅ Configured in `k8s/configmap.yaml`

### Data Storage (No Dropbox)
- ✅ All data stored in Kubernetes PersistentVolumeClaim
- ✅ Mounted at `/app/data` in container
- ✅ Stores: uploaded books, reading progress, highlights, annotations

### Files Created/Modified

```
.github/workflows/release.yml  # Builds ARM64 images to your GHCR
k8s/
  ├── configmap.yaml          # Your domain & app URL
  ├── secret.yaml             # Minimal (no Dropbox)
  ├── deployment.yaml         # 1 replica, your registry image
  ├── service.yaml            # LoadBalancer on port 3005
  └── pvc.yaml                # 10Gi storage
apps/reader/.env.local         # No Dropbox config
FORK.md                        # Fork management guide
QUICKSTART.md                  # Step-by-step deployment
DEPLOYMENT.md                  # Comprehensive docs
RELEASE.md                     # Release process
```

## What You Need to Do

### 1. Fork the Repository

Since this is currently the original `pacexy/flow` repo, you need to:

**Option A: You're Already in a Local Clone**

If this directory is just a clone (not a fork):

```bash
# Check current remote
cd /Users/matthewbrandeburg/dmc/tests/flow
git remote -v

# If it shows pacexy/flow, you need to fork
```

**Fork on GitHub:**
1. Go to <https://github.com/pacexy/flow>
2. Click "Fork" button (top right)
3. Choose your account as destination
4. Wait for fork to complete

**Update your local repo:**

```bash
cd /Users/matthewbrandeburg/dmc/tests/flow

# Rename current remote to upstream
git remote rename origin upstream

# Add your fork as origin
git remote add origin https://github.com/YOUR_USERNAME/flow.git

# Push all your changes to your fork
git push origin main

# Push all the new files
git add .
git commit -m "feat: custom Raspberry Pi deployment configuration"
git push origin main
```

### 2. Update ONE File

Edit `k8s/deployment.yaml` and replace `YOUR_USERNAME`:

```yaml
# Line ~18
image: ghcr.io/matthewbrandeburg/flow:latest  # Use YOUR GitHub username
```

```bash
# After editing
git add k8s/deployment.yaml
git commit -m "fix: update image registry to my username"
git push origin main
```

### 3. Enable GitHub Actions

1. Go to your fork: `https://github.com/YOUR_USERNAME/flow`
2. Click **Settings** tab
3. Click **Actions** → **General** (left sidebar)
4. Scroll to "Workflow permissions"
5. Select **"Read and write permissions"**
6. Click **Save**

### 4. Trigger First Build

Your push should auto-trigger, but you can also:

1. Go to **Actions** tab in your fork
2. Click **"Build and Push Docker Image"**
3. Click **"Run workflow"** → **"Run workflow"**
4. Wait ~10-15 minutes for ARM64 build

### 5. Make Image Public (Recommended)

1. Go to `https://github.com/YOUR_USERNAME?tab=packages`
2. Find **"flow"** package
3. Click it → **"Package settings"**
4. Scroll to "Danger Zone"
5. **"Change visibility"** → **"Public"**

### 6. Deploy to Your Kubernetes

```bash
# Apply all manifests
kubectl apply -f k8s/

# Watch it start
kubectl get pods -l app=flow-reader -w
```

### 7. Get Your LoadBalancer IP

```bash
kubectl get svc flow-reader

# Note the EXTERNAL-IP
# Example: 192.168.1.100
```

### 8. Point Your DNS

Configure your DNS or reverse proxy to route:

```
ebooks.matthewbrandeburg.com → [EXTERNAL-IP]:3005
```

### 9. Test It!

```bash
# Port-forward to test locally first
kubectl port-forward svc/flow-reader 3005:3005

# Open http://localhost:3005
# If that works, your deployment is good!
```

Then open: `https://ebooks.matthewbrandeburg.com`

## Keeping It Updated

### Sync from Upstream (Monthly/Quarterly)

```bash
cd /Users/matthewbrandeburg/dmc/tests/flow

# Pull latest from original Flow project
git fetch upstream
git merge upstream/main

# Resolve conflicts (keep your k8s/ files)
# Test locally
pnpm install
pnpm dev

# Push to your fork (triggers rebuild)
git push origin main

# Update Kubernetes
kubectl rollout restart deployment/flow-reader
```

### Making Your Own Changes

```bash
# Edit code
# Test with: pnpm dev

# Commit and push
git add .
git commit -m "feat: my awesome feature"
git push origin main

# GitHub Actions builds automatically
# Then update K8s:
kubectl rollout restart deployment/flow-reader
```

## Backing Up Your Data

All your books, highlights, and reading progress live in the PVC:

```bash
# Backup
POD=$(kubectl get pod -l app=flow-reader -o jsonpath="{.items[0].metadata.name}")
kubectl exec $POD -- tar czf - /app/data > ~/flow-backup-$(date +%Y%m%d).tar.gz

# Restore
kubectl exec -i $POD -- tar xzf - -C / < ~/flow-backup-20250115.tar.gz
kubectl rollout restart deployment/flow-reader
```

## Quick Reference

```bash
# View logs
kubectl logs -l app=flow-reader -f

# Restart
kubectl rollout restart deployment/flow-reader

# Scale up
kubectl scale deployment flow-reader --replicas=2

# Update config
kubectl apply -f k8s/configmap.yaml
kubectl rollout restart deployment/flow-reader

# Check storage
kubectl get pvc flow-reader-data
```

## Troubleshooting

### Can't Pull Image
- Make GHCR package public (see step 5 above)
- Or create imagePullSecret (see QUICKSTART.md)

### LoadBalancer Stuck on "Pending"
- You might need MetalLB on Raspberry Pi
- Or use NodePort instead of LoadBalancer

### PVC Not Binding
- Check: `kubectl get storageclass`
- Update `storageClassName` in `k8s/pvc.yaml`

See **QUICKSTART.md** for detailed troubleshooting!

## Files to Read

- **QUICKSTART.md** - Step-by-step deployment guide
- **FORK.md** - How to maintain your fork & sync upstream
- **DEPLOYMENT.md** - Comprehensive Kubernetes documentation
- **RELEASE.md** - Release process overview

## Your Checklist

- [ ] Fork pacexy/flow on GitHub
- [ ] Update local git remotes
- [ ] Edit `k8s/deployment.yaml` with your GitHub username
- [ ] Push to your fork
- [ ] Enable GitHub Actions write permissions
- [ ] Trigger first build (or wait for auto-build)
- [ ] Make GHCR package public
- [ ] Deploy to Kubernetes: `kubectl apply -f k8s/`
- [ ] Get LoadBalancer IP
- [ ] Configure DNS: ebooks.matthewbrandeburg.com → IP:3005
- [ ] Test and enjoy!

---

**Questions?** Check FORK.md or QUICKSTART.md for detailed walkthroughs!
