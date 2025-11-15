# Release and Deployment Setup

This document provides a quick reference for releasing Flow and deploying it to Kubernetes.

## 📦 Release Process

### 1. Creating a Release

Flow uses GitHub Actions to automatically build and push Docker images when you create a version tag:

```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0
```

The GitHub Actions workflow (`.github/workflows/release.yml`) will:
- Build the Docker image for AMD64 and ARM64 architectures
- Push to GitHub Container Registry (ghcr.io)
- Tag with version number, branch, and 'latest'
- Create build attestation for security

### 2. Manual Release (Alternative)

If you prefer to build locally or use a different registry:

```bash
# Build the image
docker build -t YOUR_REGISTRY/flow:v1.0.0 .

# Login to your registry
docker login YOUR_REGISTRY

# Push the image
docker push YOUR_REGISTRY/flow:v1.0.0
```

Supported registries:
- GitHub Container Registry (ghcr.io)
- Docker Hub (docker.io)
- Google Container Registry (gcr.io)
- Amazon ECR
- Azure Container Registry

## 🚀 Kubernetes Deployment

### Prerequisites Checklist

- [ ] Kubernetes cluster (1.19+)
- [ ] kubectl configured
- [ ] Docker image built and pushed
- [ ] Domain name configured (for ingress)
- [ ] Ingress controller installed

### Quick Deploy

```bash
# 1. Update k8s/deployment.yaml with your image URL
# 2. Update k8s/ingress.yaml with your domain
# 3. Update k8s/configmap.yaml and k8s/secret.yaml with your values

# Deploy all resources
kubectl apply -f k8s/

# Watch deployment
kubectl get pods -l app=flow-reader -w
```

### Configuration Files

| File | Purpose |
|------|---------|
| `k8s/configmap.yaml` | Non-sensitive environment variables |
| `k8s/secret.yaml` | Sensitive credentials (Dropbox, Sentry) |
| `k8s/pvc.yaml` | Persistent storage (10Gi default) |
| `k8s/deployment.yaml` | Application deployment (2 replicas) |
| `k8s/service.yaml` | ClusterIP service on port 80 |
| `k8s/ingress.yaml` | External access configuration |

## 🔧 Environment Variables

### Development (.env.local)

Created from `.env.local.example` files:
- `apps/reader/.env.local` - Reader app configuration
- `apps/website/.env.local` - Website configuration

### Production (Kubernetes)

Managed via ConfigMap and Secret:

**ConfigMap (non-sensitive):**
- `NEXT_PUBLIC_WEBSITE_URL` - Marketing site URL
- `NODE_ENV=production`

**Secret (sensitive):**
- `NEXT_PUBLIC_DROPBOX_CLIENT_ID` - Dropbox app ID (optional)
- `DROPBOX_CLIENT_SECRET` - Dropbox secret (optional)
- Sentry credentials (optional)

## 📝 Customization Guide

### 1. Update Image Registry

In `k8s/deployment.yaml`:
```yaml
image: YOUR_REGISTRY/flow:latest  # Change this
```

In `.github/workflows/release.yml`:
```yaml
env:
  REGISTRY: ghcr.io  # Change to your registry
```

### 2. Update Domain

In `k8s/ingress.yaml`:
```yaml
spec:
  rules:
  - host: reader.example.com  # Change this
```

### 3. Adjust Resources

In `k8s/deployment.yaml`:
```yaml
resources:
  requests:
    memory: "256Mi"  # Adjust based on load
    cpu: "100m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

### 4. Scale Replicas

```bash
kubectl scale deployment flow-reader --replicas=5
```

## 🔒 Security Checklist

- [ ] Use HTTPS/TLS for production (configure in ingress)
- [ ] Store secrets in Kubernetes Secrets, not ConfigMaps
- [ ] Use private registry with imagePullSecrets
- [ ] Configure network policies
- [ ] Enable pod security policies
- [ ] Rotate Dropbox/Sentry credentials regularly
- [ ] Set up RBAC for kubectl access

## 📊 Monitoring

### Health Checks
- Liveness probe: GET / every 10s
- Readiness probe: GET / every 5s

### View Logs
```bash
kubectl logs -l app=flow-reader -f
```

### View Metrics
```bash
kubectl top pods -l app=flow-reader
```

## 🆘 Common Issues

### Image Pull Errors
```bash
# Create registry secret
kubectl create secret docker-registry registry-secret \
  --docker-server=YOUR_REGISTRY \
  --docker-username=USERNAME \
  --docker-password=TOKEN
```

### Persistent Volume Not Binding
```bash
# Check available storage classes
kubectl get storageclass

# Update k8s/pvc.yaml with correct storageClassName
```

### Environment Variables Not Loading
```bash
# Verify ConfigMap
kubectl get configmap flow-reader-config -o yaml

# Verify Secret
kubectl get secret flow-reader-secrets -o yaml

# Restart pods
kubectl rollout restart deployment/flow-reader
```

## 📚 Additional Resources

- Full deployment guide: `DEPLOYMENT.md`
- Repository guidelines: `AGENTS.md`
- Project README: `README.md`

## 🎯 Next Steps After Deployment

1. Configure DNS to point to your ingress
2. Set up TLS certificates (Let's Encrypt via cert-manager)
3. Configure monitoring (Prometheus/Grafana)
4. Set up log aggregation
5. Implement automated backups
6. Configure horizontal pod autoscaling
7. Set up CI/CD for automated deployments
