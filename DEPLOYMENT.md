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

We've provided a script to create and configure the Artifact Registry repository:

```bash
# Make the script executable
chmod +x scripts/setup-artifact-registry.sh

# Run the script
./scripts/setup-artifact-registry.sh
```

This script will:
1. Check if the repository already exists
2. Create a Docker repository named `testero` in the us-central1 region if it doesn't exist
3. Set up lifecycle policies for automatic cleanup:
   - Keep only the 10 most recent versions (excluding 'latest' and semantic version tags)
   - Remove untagged images older than 14 days

Alternatively, you can create the repository manually:

```bash
gcloud artifacts repositories create testero \
  --repository-format=docker \
  --location=us-central1 \
  --description="Docker repository for Testero frontend"
```

Note that the manual approach doesn't set up lifecycle policies.

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

## Automated Deployment

### GitHub Actions

For automated CI/CD deployment using GitHub Actions:

1. Set up the required GitHub secrets as described in [GitHub Secrets Setup](./docs/github-secrets-setup.md)
2. Push to the main branch to trigger the full CI/CD pipeline
3. Create pull requests to run code quality checks and build verification without deployment

The comprehensive CI/CD pipeline is configured in `.github/workflows/deploy-to-cloud-run.yml` and includes:

- **Code Quality Checks**: Linting and type checking
- **Build Verification**: Building and pushing Docker images
- **Deployment**: Deploying to Cloud Run (only on main branch)

The workflow provides:
- Automated quality checks for all pull requests
- Build verification without deployment for pull requests
- Full deployment pipeline for main branch pushes
- Status notifications for deployment success or failure

See [GitHub Actions Deployment](./docs/github-actions-deployment.md) for detailed information about the CI/CD pipeline.

### Cloud Build (Alternative)

Alternatively, you can use Cloud Build for automated CI/CD deployment:

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

For specific issues with Artifact Registry (such as 404 errors when pushing images), refer to our detailed troubleshooting guide:
- [Troubleshooting Artifact Registry Issues](./docs/troubleshooting-artifact-registry.md)

We've also provided a troubleshooting script that can automatically identify and fix common issues:
```bash
# Make the script executable
chmod +x scripts/troubleshoot-artifact-registry.sh

# Run the script
./scripts/troubleshoot-artifact-registry.sh
```

## Cost Management

Cloud Run charges based on:
- Number of requests
- Time spent processing requests
- Memory and CPU allocated

Setting min-instances to 0 allows the service to scale to zero when not in use, minimizing costs.
