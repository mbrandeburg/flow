# Quick Start: Raspberry Pi Deployment

## Your Configuration

- **Domain:** ebooks.matthewbrandeburg.com
- **Port:** 3005 (LoadBalancer)
- **Storage:** PVC for all user data (books, highlights, progress)
- **Features:** No Dropbox sync (all data in PVC)
- **Platform:** Raspberry Pi Kubernetes cluster

## Step-by-Step Deployment

### 1. Fork and Setup Repository

```bash
# Fork https://github.com/pacexy/flow to your GitHub account
# Then clone your fork

cd ~/dmc/tests
mv flow flow-original  # backup current directory
git clone https://github.com/YOUR_USERNAME/flow.git
cd flow

# Add upstream for future updates
git remote add upstream https://github.com/pacexy/flow.git

# Copy your custom files from this directory
cp -r ../flow-original/k8s .
cp -r ../flow-original/.github .
cp ../flow-original/DEPLOYMENT.md .
cp ../flow-original/RELEASE.md .
cp ../flow-original/FORK.md .
```

### 2. Update Configuration Files

**Edit `k8s/deployment.yaml`:**

Replace `YOUR_USERNAME` with your actual GitHub username:

```yaml
image: ghcr.io/YOUR_USERNAME/flow:latest
```

**Verify `k8s/configmap.yaml`:**

Should have:

```yaml
NEXT_PUBLIC_APP_URL: "https://ebooks.matthewbrandeburg.com"
```

**Verify `k8s/service.yaml`:**

Should have:

```yaml
type: LoadBalancer
ports:
- port: 3005
  targetPort: 3000
```

### 3. Commit and Push to Trigger Build

```bash
git add .
git commit -m "feat: custom deployment for Raspberry Pi"
git push origin main
```

### 4. Enable GitHub Actions

1. Go to your fork on GitHub
2. Settings → Actions → General
3. Workflow permissions → "Read and write permissions"
4. Save

### 5. Trigger First Build

Either wait for the push to trigger it, or:

1. Go to Actions tab
2. Click "Build and Push Docker Image"
3. Click "Run workflow"
4. Wait for build to complete (~10-15 minutes for ARM64)

### 6. Make Image Public (If Needed)

If you get image pull errors:

1. Go to https://github.com/YOUR_USERNAME?tab=packages
2. Click "flow" package
3. Package settings → Change visibility → Public

### 7. Deploy to Kubernetes

```bash
# Create namespace (optional)
kubectl create namespace flow

# If using namespace, update all k8s/*.yaml files to have:
# namespace: flow

# Deploy everything
kubectl apply -f k8s/

# Watch deployment
kubectl get pods -l app=flow-reader -w
```

### 8. Get LoadBalancer IP

```bash
# Check service
kubectl get svc flow-reader

# Should show EXTERNAL-IP (your LoadBalancer IP)
# Example output:
# NAME          TYPE           CLUSTER-IP      EXTERNAL-IP      PORT(S)
# flow-reader   LoadBalancer   10.43.123.45    192.168.1.100    3005:30123/TCP
```

### 9. Configure DNS

Point your domain to the LoadBalancer IP:

```
ebooks.matthewbrandeburg.com → 192.168.1.100:3005
```

Or configure your reverse proxy/ingress to route to the LoadBalancer.

### 10. Verify Deployment

```bash
# Check pods are running
kubectl get pods -l app=flow-reader

# Check logs
kubectl logs -l app=flow-reader --tail=50

# Test locally first
kubectl port-forward svc/flow-reader 3005:3005

# Then open http://localhost:3005
```

### 11. Access Your App

Open https://ebooks.matthewbrandeburg.com

Upload an ePub and verify it works!

## Data Storage

### What's in the PVC

All user data is stored in the PersistentVolumeClaim:

- ePub files you upload
- Reading progress/bookmarks
- Highlights and annotations
- App settings and preferences

### Backup Your Data

```bash
# Get pod name
POD=$(kubectl get pod -l app=flow-reader -o jsonpath="{.items[0].metadata.name}")

# Create backup
kubectl exec $POD -- tar czf - /app/data > ~/backups/flow-backup-$(date +%Y%m%d).tar.gz
```

### Restore Data

```bash
# Upload backup
POD=$(kubectl get pod -l app=flow-reader -o jsonpath="{.items[0].metadata.name}")
kubectl exec -i $POD -- tar xzf - -C / < ~/backups/flow-backup-20250115.tar.gz

# Restart
kubectl rollout restart deployment/flow-reader
```

## Updating from Upstream

When the original Flow project releases updates:

```bash
# Sync from upstream
cd ~/dmc/tests/flow
git fetch upstream
git checkout main
git merge upstream/main

# Resolve any conflicts (keep your k8s/ configs)

# Test locally
pnpm install
pnpm dev

# If all looks good, push
git push origin main

# GitHub Actions will rebuild automatically

# Update Kubernetes
kubectl rollout restart deployment/flow-reader
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl describe pod -l app=flow-reader

# Check logs
kubectl logs -l app=flow-reader

# Common issues:
# - Image pull error: Make GHCR package public
# - PVC not binding: Check storage class exists
```

### Image Pull Errors

```bash
# Option 1: Make package public (recommended)
# Go to GitHub packages and change visibility

# Option 2: Use image pull secret
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=YOUR_USERNAME \
  --docker-password=YOUR_GITHUB_TOKEN

# Then uncomment imagePullSecrets in k8s/deployment.yaml
```

### LoadBalancer Not Getting External IP

```bash
# Check if your cluster has a LoadBalancer controller
kubectl get svc --all-namespaces

# For Raspberry Pi, you might need MetalLB:
# https://metallb.universe.tf/installation/

# Or use NodePort instead:
# Edit k8s/service.yaml, change type to NodePort
```

### PVC Not Binding

```bash
# Check storage classes
kubectl get storageclass

# Update k8s/pvc.yaml with correct storageClassName
# Then reapply:
kubectl delete pvc flow-reader-data
kubectl apply -f k8s/pvc.yaml
```

## Resource Limits for Raspberry Pi

Current settings (256Mi-512Mi RAM) should work fine. If you have limited resources:

```yaml
# In k8s/deployment.yaml, reduce limits:
resources:
  requests:
    memory: "128Mi"
    cpu: "50m"
  limits:
    memory: "256Mi"
    cpu: "250m"
```

## TLS/HTTPS Setup

Since you're using a LoadBalancer, handle TLS at your reverse proxy level (Traefik, nginx, etc.) or use cert-manager with an ingress.

For a simple setup, you could:

1. Install nginx-ingress or Traefik
2. Install cert-manager
3. Create an Ingress resource with TLS

See `DEPLOYMENT.md` for detailed TLS setup instructions.

## Summary Commands

```bash
# Deploy
kubectl apply -f k8s/

# Update
git pull origin main && kubectl rollout restart deployment/flow-reader

# Logs
kubectl logs -l app=flow-reader -f

# Backup
kubectl exec $(kubectl get pod -l app=flow-reader -o jsonpath="{.items[0].metadata.name}") -- tar czf - /app/data > backup.tar.gz

# Scale
kubectl scale deployment flow-reader --replicas=2
```

## Next Steps

- [ ] Fork repository
- [ ] Update k8s/deployment.yaml with your username
- [ ] Push to trigger build
- [ ] Deploy to Kubernetes
- [ ] Configure DNS
- [ ] Set up backups
- [ ] Set up TLS
- [ ] Enjoy your personal ebook reader!
