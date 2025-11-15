# Flow - Personal Deployment

Your personal fork of Flow configured for Raspberry Pi Kubernetes deployment at **ebooks.matthewbrandeburg.com**.

## Quick Links

- **Production:** https://ebooks.matthewbrandeburg.com
- **Upstream:** https://github.com/pacexy/flow
- **Your Fork:** https://github.com/mbrandeburg/flow

## Local Development

### Prerequisites

- [Node.js](https://nodejs.org) (v18+)
- [pnpm](https://pnpm.io/installation)
- [Docker](https://www.docker.com/get-started)

### Setup

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
# Open http://localhost:7127 (reader)
# Open http://localhost:7117 (website)
```

### Test Docker Build Locally

Before deploying to Kubernetes, test the Docker image:

```bash
# Build the image (ARM64 for Raspberry Pi)
docker build -t flow:local .

# Or build for your current architecture (faster for testing)
docker build --platform linux/amd64 -t flow:local .

# Run the container
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  flow:local

# Open http://localhost:3000
# Upload an ePub file and test functionality
```

### Test with docker-compose

```bash
# Build and run
docker compose up -d

# View logs
docker compose logs -f

# Open http://localhost:3000

# Stop
docker compose down
```

## Deployment to Kubernetes

### One-Time Setup

#### 1. Enable GitHub Actions

1. Go to: https://github.com/mbrandeburg/flow/settings/actions
2. Click **Actions** → **General**
3. Under "Workflow permissions":
   - Select **"Read and write permissions"**
   - Save

#### 2. Trigger First Build

Your push already triggered a build. Check progress:
- https://github.com/mbrandeburg/flow/actions

Or manually trigger:

```bash
# Create version tag
git tag v1.0.0
git push origin v1.0.0
```

Build takes ~10-15 minutes for ARM64.

#### 3. Make Docker Image Public

After build completes:

1. Go to: https://github.com/mbrandeburg?tab=packages
2. Click **"flow"** package
3. **Package settings** → **Change visibility** → **Public**

#### 4. Deploy to Kubernetes

```bash
# Apply all manifests
kubectl apply -f k8s/

# Watch deployment
kubectl get pods -l app=flow-reader -w

# Should show:
# NAME                           READY   STATUS    RESTARTS   AGE
# flow-reader-xxxxxxxxxx-xxxxx   1/1     Running   0          30s
```

#### 5. Get LoadBalancer IP

```bash
kubectl get svc flow-reader

# Note the EXTERNAL-IP
# NAME          TYPE           EXTERNAL-IP      PORT(S)
# flow-reader   LoadBalancer   192.168.1.100    3005:30xxx/TCP
```

#### 6. Configure DNS

Point your DNS or reverse proxy:
```
ebooks.matthewbrandeburg.com → [EXTERNAL-IP]:3005
```

#### 7. Verify Deployment

```bash
# Port-forward to test locally
kubectl port-forward svc/flow-reader 3005:3005

# Open http://localhost:3005
# If it works, your deployment is good!
```

Then access: https://ebooks.matthewbrandeburg.com

### Regular Operations

#### View Logs

```bash
kubectl logs -l app=flow-reader -f
```

#### Restart Deployment

```bash
kubectl rollout restart deployment/flow-reader
```

#### Update Configuration

```bash
# Edit configmap
kubectl edit configmap flow-reader-config

# Or update file and reapply
kubectl apply -f k8s/configmap.yaml

# Restart to pick up changes
kubectl rollout restart deployment/flow-reader
```

#### Scale Deployment

```bash
# Scale up
kubectl scale deployment flow-reader --replicas=2

# Scale down
kubectl scale deployment flow-reader --replicas=1
```

## Data Management

### Backup

All user data (books, highlights, reading progress) is stored in the PersistentVolumeClaim.

```bash
# Create backup
POD=$(kubectl get pod -l app=flow-reader -o jsonpath="{.items[0].metadata.name}")
kubectl exec $POD -- tar czf - /app/data > flow-backup-$(date +%Y%m%d).tar.gz

# Store backup safely
mv flow-backup-*.tar.gz ~/backups/
```

### Restore

```bash
# Restore from backup
POD=$(kubectl get pod -l app=flow-reader -o jsonpath="{.items[0].metadata.name}")
kubectl exec -i $POD -- tar xzf - -C / < ~/backups/flow-backup-20250115.tar.gz

# Restart deployment
kubectl rollout restart deployment/flow-reader
```

## Updating from Upstream

When the original Flow project releases updates:

```bash
# Sync from upstream
git fetch upstream
git merge upstream/main

# Resolve any conflicts (keep your k8s/ configs)

# Test locally first
pnpm install
pnpm dev

# Test Docker build
docker build -t flow:test .
docker run -p 3000:3000 flow:test

# If everything works, push to trigger rebuild
git push origin main

# Wait for GitHub Actions to build (~10-15 min)

# Update Kubernetes
kubectl rollout restart deployment/flow-reader
```

## Making Your Own Changes

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and test
pnpm dev

# Commit and push
git add .
git commit -m "feat: my awesome feature"
git push origin feature/my-feature

# Merge to main
git checkout main
git merge feature/my-feature
git push origin main

# GitHub Actions builds automatically
# Then update Kubernetes
kubectl rollout restart deployment/flow-reader
```

## Troubleshooting

### Can't Pull Docker Image

**Problem:** `ImagePullBackOff` error

**Solution:**
1. Make package public: https://github.com/mbrandeburg?tab=packages
2. Or create image pull secret:

```bash
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=mbrandeburg \
  --docker-password=YOUR_GITHUB_TOKEN

# Uncomment imagePullSecrets in k8s/deployment.yaml
```

### LoadBalancer Stuck on Pending

**Problem:** Service shows `<pending>` for EXTERNAL-IP

**Solution:** Your Raspberry Pi cluster might need MetalLB for LoadBalancer support.

Alternative - use NodePort:

```bash
# Edit k8s/service.yaml, change type to NodePort
kubectl apply -f k8s/service.yaml

# Access via NodeIP:NodePort
```

### PVC Not Binding

**Problem:** PersistentVolumeClaim stuck in `Pending`

**Solution:**

```bash
# Check available storage classes
kubectl get storageclass

# Update k8s/pvc.yaml with correct storageClassName
# Then reapply
kubectl delete pvc flow-reader-data
kubectl apply -f k8s/pvc.yaml
```

### Pod Crashes or Restarts

```bash
# Check pod events
kubectl describe pod -l app=flow-reader

# Check logs
kubectl logs -l app=flow-reader --tail=100

# Common issues:
# - Out of memory: Increase limits in k8s/deployment.yaml
# - Missing env vars: Check configmap and secret
```

## Repository Structure

```
.
├── .github/workflows/
│   └── release.yml          # CI/CD for Docker builds
├── k8s/                     # Kubernetes manifests
│   ├── configmap.yaml      # Your domain & app config
│   ├── secret.yaml         # Sensitive credentials
│   ├── deployment.yaml     # App deployment
│   ├── service.yaml        # LoadBalancer on port 3005
│   └── pvc.yaml            # 10Gi storage
├── apps/
│   ├── reader/             # Main ePub reader app
│   └── website/            # Marketing website
├── packages/
│   ├── epubjs/             # ePub.js library
│   ├── internal/           # Shared utilities
│   └── tailwind/           # Tailwind config
├── DEPLOYMENT.md           # Comprehensive K8s docs
├── FORK.md                 # Fork management guide
├── QUICKSTART.md           # Step-by-step deployment
├── SETUP.md                # Your personal checklist
└── README.md               # This file
```

## Configuration

### Environment Variables

**Development** (apps/reader/.env.local):
```bash
NEXT_PUBLIC_WEBSITE_URL=https://flowoss.com
```

**Production** (Kubernetes ConfigMap/Secret):
```yaml
# ConfigMap
NEXT_PUBLIC_APP_URL: "https://ebooks.matthewbrandeburg.com"
NODE_ENV: "production"

# Secret (optional)
SENTRY_DSN: ""  # Error tracking
```

### Kubernetes Resources

- **Replicas:** 1 (suitable for Raspberry Pi)
- **Memory:** 256Mi request, 512Mi limit
- **CPU:** 100m request, 500m limit
- **Storage:** 10Gi PVC
- **Port:** 3005 (external), 3000 (container)

Adjust in `k8s/deployment.yaml` based on your needs.

## Documentation

- **SETUP.md** - Your personalized deployment checklist
- **QUICKSTART.md** - Step-by-step deployment guide
- **FORK.md** - Fork management & syncing upstream
- **DEPLOYMENT.md** - Comprehensive Kubernetes documentation
- **RELEASE.md** - Release process overview

## Quick Commands

```bash
# Local development
pnpm dev

# Local Docker test
docker build -t flow:local . && docker run -p 3000:3000 flow:local

# Deploy to K8s
kubectl apply -f k8s/

# View status
kubectl get all -l app=flow-reader

# View logs
kubectl logs -l app=flow-reader -f

# Restart
kubectl rollout restart deployment/flow-reader

# Backup data
kubectl exec $(kubectl get pod -l app=flow-reader -o jsonpath="{.items[0].metadata.name}") \
  -- tar czf - /app/data > backup.tar.gz

# Sync from upstream
git fetch upstream && git merge upstream/main && git push origin main
```

## License

Same as upstream: See [LICENSE](LICENSE)

## Credits

- Original project: [pacexy/flow](https://github.com/pacexy/flow)
- [Epub.js](https://github.com/futurepress/epub.js/)
- [Next.js](https://nextjs.org/)
- [React](https://github.com/facebook/react)
