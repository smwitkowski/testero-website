# Testero Frontend Deployment Guide

This guide explains how to deploy the Testero frontend application to Google Cloud Platform (GCP) Cloud Run.

## Prerequisites

Before deploying, ensure you have the following:

1. A GCP account with billing enabled
2. The [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed and configured
3. Docker installed on your local machine (for local testing)
4. Necessary permissions to create and manage GCP resources

## Configuration Files

The deployment setup includes the following files:

- `Dockerfile`: Defines how to build the container image
- `.dockerignore`: Specifies which files to exclude from the Docker build
- `cloudbuild.yaml`: Configures the automated build and deployment process
- `next.config.mjs`: Configured with `output: 'standalone'` for optimal containerization

## Manual Deployment Steps

### 1. Build the Docker image locally (optional, for testing)

```bash
docker build -t testero-frontend .
docker run -p 3000:3000 testero-frontend
```

Visit `http://localhost:3000` to verify the application works correctly.

### 2. Set up GCP Project

If you haven't already, create a new GCP project or select an existing one:

```bash
gcloud projects create testero-project --name="Testero Project"
gcloud config set project testero-project
```

### 3. Enable required APIs

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

### 3.1. Create Artifact Registry repository

```bash
gcloud artifacts repositories create testero \
  --repository-format=docker \
  --location=us-central1 \
  --description="Docker repository for Testero frontend"
```

### 4. Build and deploy manually

```bash
# Configure Docker to use Google Cloud as a credential helper
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build and tag the image
docker build -t us-central1-docker.pkg.dev/testero-project/testero/frontend:latest .

# Push to Artifact Registry
docker push us-central1-docker.pkg.dev/testero-project/testero/frontend:latest

# Deploy to Cloud Run
gcloud run deploy testero-frontend \
  --image=us-central1-docker.pkg.dev/testero-project/testero/frontend:latest \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --port=3000 \
  --set-env-vars=NODE_ENV=production
```

## Automated Deployment with Cloud Build

For automated CI/CD deployment:

1. Connect your GitHub repository to Cloud Build
2. Create a trigger that uses the `cloudbuild.yaml` configuration

```bash
gcloud builds triggers create github \
  --repo=your-repo-name \
  --branch-pattern=main \
  --build-config=cloudbuild.yaml
```

Now, every push to the main branch will trigger a build and deployment to Cloud Run.

## Cloud Run Configuration

The Cloud Run service is configured with:

- **Memory**: 1GB
- **CPU**: 1 vCPU
- **Concurrency**: Default (80)
- **Scaling**: Min instances = 0, Max instances = 10
- **Authentication**: Public (allow unauthenticated)
- **Region**: us-central1 (change as needed)

## Environment Variables

The following environment variables are set in the Cloud Run service:

- `NODE_ENV=production`

Add additional environment variables as needed:

```bash
gcloud run services update testero-frontend \
  --set-env-vars=KEY1=VALUE1,KEY2=VALUE2
```

## Custom Domain Setup

To map a custom domain to your Cloud Run service:

1. Verify domain ownership in GCP
2. Map the domain to your service:

```bash
gcloud beta run domain-mappings create \
  --service=testero-frontend \
  --domain=www.yourdomain.com \
  --region=us-central1
```

3. Update your DNS records as instructed by GCP

## Monitoring and Logging

- View logs in the GCP Console under Cloud Run > testero-frontend > Logs
- Set up alerts for errors or high latency in Cloud Monitoring
- Monitor resource usage in the Cloud Run dashboard

## Troubleshooting

If you encounter issues:

1. Check the container logs in Cloud Run
2. Verify the build logs in Cloud Build
3. Test the container locally to isolate the issue
4. Ensure all required environment variables are set
5. Check for any region-specific issues

## Cost Management

Cloud Run charges based on:
- Number of requests
- Time spent processing requests
- Memory and CPU allocated

Setting min-instances to 0 allows the service to scale to zero when not in use, minimizing costs.
