# Kubernetes Deployment Guide

This guide walks you through deploying Flow to a Kubernetes cluster with persistent storage.

## Prerequisites

- Kubernetes cluster (v1.19+)
- `kubectl` configured to access your cluster
- Docker image pushed to a container registry (GHCR, Docker Hub, etc.)
- Ingress controller installed (nginx-ingress, traefik, etc.)
- Optional: cert-manager for TLS certificates

## Quick Start

### 1. Build and Push Docker Image

#### Option A: Using GitHub Actions (Recommended)

Push a version tag to trigger the automated build:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The GitHub Actions workflow will automatically build and push the image to GitHub Container Registry (ghcr.io).

#### Option B: Manual Build

```bash
# Build the image
docker build -t ghcr.io/pacexy/flow:latest .

# Log in to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Push the image
docker push ghcr.io/pacexy/flow:latest
```

### 2. Update Kubernetes Manifests

Edit the following files in the `k8s/` directory:

**k8s/deployment.yaml:**
- Update the `image` field with your registry URL
- Adjust resource limits based on your needs
- Uncomment `imagePullSecrets` if using a private registry

**k8s/ingress.yaml:**
- Update the `host` field with your domain
- Uncomment TLS configuration if using HTTPS
- Update annotations for your ingress controller

**k8s/configmap.yaml:**
- Set `NEXT_PUBLIC_WEBSITE_URL` to your marketing site URL

**k8s/secret.yaml:**
- Add Dropbox credentials if using sync features
- Add Sentry credentials if using error tracking

**k8s/pvc.yaml:**
- Adjust storage size as needed
- Set `storageClassName` based on your cluster

### 3. Deploy to Kubernetes

```bash
# Create namespace (optional)
kubectl create namespace flow

# Apply all manifests
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml

# Or apply all at once
kubectl apply -f k8s/
```

### 4. Verify Deployment

```bash
# Check pod status
kubectl get pods -l app=flow-reader

# Check service
kubectl get svc flow-reader

# Check ingress
kubectl get ingress flow-reader

# View logs
kubectl logs -l app=flow-reader --tail=100 -f

# Check persistent volume
kubectl get pvc flow-reader-data
```

## Environment Variables

### Required
- `NODE_ENV` - Set to `production` (configured in ConfigMap)
- `PORT` - Set to `3000` (configured in Deployment)

### Optional
- `NEXT_PUBLIC_DROPBOX_CLIENT_ID` - Dropbox app client ID for cloud sync
- `DROPBOX_CLIENT_SECRET` - Dropbox app secret
- `NEXT_PUBLIC_WEBSITE_URL` - URL of the marketing website
- `SENTRY_DSN` - Sentry error tracking DSN
- `SENTRY_ORG` - Sentry organization
- `SENTRY_PROJECT` - Sentry project name

### Kubernetes-Managed

All environment variables are managed through:
- **ConfigMap** (`flow-reader-config`) - Non-sensitive configuration
- **Secret** (`flow-reader-secrets`) - Sensitive credentials

To update environment variables:

```bash
# Edit the configmap or secret
kubectl edit configmap flow-reader-config
kubectl edit secret flow-reader-secrets

# Restart pods to pick up changes
kubectl rollout restart deployment/flow-reader
```

## Persistent Storage

The deployment uses a PersistentVolumeClaim for data persistence:

- **Name:** `flow-reader-data`
- **Default Size:** 10Gi
- **Access Mode:** ReadWriteOnce
- **Mount Path:** `/app/data`

### Backup Data

```bash
# Get the pod name
POD_NAME=$(kubectl get pod -l app=flow-reader -o jsonpath="{.items[0].metadata.name}")

# Create backup
kubectl exec $POD_NAME -- tar czf - /app/data > flow-backup-$(date +%Y%m%d).tar.gz
```

### Restore Data

```bash
# Upload backup to pod
kubectl exec -i $POD_NAME -- tar xzf - -C / < flow-backup-20250115.tar.gz

# Restart deployment
kubectl rollout restart deployment/flow-reader
```

## Scaling

### Horizontal Scaling

```bash
# Scale to 3 replicas
kubectl scale deployment flow-reader --replicas=3

# Or update deployment.yaml and apply
kubectl apply -f k8s/deployment.yaml
```

### Vertical Scaling

Update resource limits in `k8s/deployment.yaml`:

```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

Then apply:

```bash
kubectl apply -f k8s/deployment.yaml
```

## TLS/HTTPS Setup

### Using cert-manager

1. Install cert-manager:

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
```

2. Create a ClusterIssuer:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

3. Update `k8s/ingress.yaml` with TLS configuration (uncomment the TLS section)

4. Apply the ingress:

```bash
kubectl apply -f k8s/ingress.yaml
```

## Using Private Registry

If using a private container registry:

1. Create registry secret:

```bash
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=YOUR_USERNAME \
  --docker-password=YOUR_TOKEN \
  --docker-email=YOUR_EMAIL
```

2. Uncomment `imagePullSecrets` in `k8s/deployment.yaml`

3. Apply the deployment:

```bash
kubectl apply -f k8s/deployment.yaml
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod events
kubectl describe pod -l app=flow-reader

# Check logs
kubectl logs -l app=flow-reader --tail=50

# Check resource constraints
kubectl top pods
```

### Image Pull Errors

```bash
# Verify image exists
docker pull ghcr.io/pacexy/flow:latest

# Check image pull secret
kubectl get secret ghcr-secret -o yaml

# Recreate the secret if needed
```

### Persistent Volume Issues

```bash
# Check PVC status
kubectl get pvc flow-reader-data

# Check PV
kubectl get pv

# Describe PVC for events
kubectl describe pvc flow-reader-data
```

### Application Errors

```bash
# Check environment variables
kubectl exec -it $(kubectl get pod -l app=flow-reader -o jsonpath="{.items[0].metadata.name}") -- env

# Check mounted volumes
kubectl exec -it $(kubectl get pod -l app=flow-reader -o jsonpath="{.items[0].metadata.name}") -- df -h

# Interactive shell for debugging
kubectl exec -it $(kubectl get pod -l app=flow-reader -o jsonpath="{.items[0].metadata.name}") -- sh
```

## Monitoring

### Health Checks

The deployment includes:
- **Liveness Probe**: Restarts unhealthy containers
- **Readiness Probe**: Removes unready pods from service

### Metrics

View pod metrics:

```bash
kubectl top pods -l app=flow-reader
```

## Cleanup

To remove the deployment:

```bash
# Delete all resources
kubectl delete -f k8s/

# Or delete individually
kubectl delete deployment flow-reader
kubectl delete service flow-reader
kubectl delete ingress flow-reader
kubectl delete configmap flow-reader-config
kubectl delete secret flow-reader-secrets

# Optional: Delete PVC (WARNING: This deletes all data)
kubectl delete pvc flow-reader-data
```

## Next Steps

- Set up monitoring with Prometheus/Grafana
- Configure horizontal pod autoscaling (HPA)
- Set up log aggregation with ELK or Loki
- Implement GitOps with ArgoCD or Flux
- Configure network policies for security
- Set up database backup automation
