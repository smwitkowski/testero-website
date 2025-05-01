# GitHub Actions Deployment to GCP Cloud Run

This document explains how to set up GitHub Actions for deploying the Testero frontend to Google Cloud Platform (GCP) Cloud Run.

## Overview

We're using GitHub Actions to automate the deployment process to GCP Cloud Run. This setup:

1. Creates a dedicated GCP service account with minimal required permissions
2. Uses the service account credentials as GitHub secrets
3. Configures a GitHub Actions workflow to build and deploy the application

## Prerequisites

- A GCP project with billing enabled
- Owner or Editor permissions on the GCP project
- Admin access to the GitHub repository
- Google Cloud SDK (gcloud) installed locally

## Step 1: Create a GCP Service Account

We've provided a script to create a service account with the necessary permissions:

```bash
# Make the script executable
chmod +x scripts/create-github-actions-service-account.sh

# Run the script
./scripts/create-github-actions-service-account.sh
```

This script will:
1. Check if the service account already exists
2. Create a service account named `github-actions-deployer` if it doesn't exist
3. Wait for the service account to propagate in GCP systems
4. Assign the following IAM roles:
   - Cloud Run Admin (`roles/run.admin`)
   - Storage Admin (`roles/artifactregistry.admin`)
   - Service Account User (`roles/iam.serviceAccountUser`)
5. Generate and download a JSON key file

> **Note:** The script is idempotent and can be run multiple times safely. It will skip the creation step if the service account already exists and proceed with assigning roles and generating a key.

## Step 2: Add GitHub Secrets

After running the script, you'll have a JSON key file. You need to add this as a secret in your GitHub repository:

1. Go to your GitHub repository
2. Navigate to Settings > Secrets and variables > Actions
3. Click "New repository secret"
4. Add the following secrets:
   - Name: `GCP_SA_KEY`
     - Value: *[Paste the entire contents of the JSON key file]*
   - Name: `GCP_PROJECT_ID`
     - Value: *[Your GCP project ID]*
   - Name: `GCP_REGION`
     - Value: *[Your GCP region, e.g., "us-central1"]*
   - Name: `ARTIFACT_REPOSITORY`
     - Value: *[Your Artifact Registry repository name, e.g., "testero"]*
   - Name: `SERVICE_NAME`
     - Value: *[Your Cloud Run service name, e.g., "testero-frontend"]*

## Step 3: Set up Artifact Registry Repository

Before the GitHub Actions workflow can push Docker images, you need to set up an Artifact Registry repository:

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

## Step 4: GitHub Actions Workflow

We've created a comprehensive CI/CD pipeline in the GitHub Actions workflow file at `.github/workflows/deploy-to-cloud-run.yml`. This workflow is divided into multiple jobs with dependencies and conditional execution:

### Workflow Triggers

The workflow is triggered by:
- Pushes to the main branch
- Pull requests targeting the main branch
- Manual triggering via the GitHub Actions UI

### Job 1: Code Quality

This job runs code quality checks:
1. Sets up Node.js environment
2. Installs dependencies
3. Runs ESLint for code linting
4. Runs TypeScript type checking

### Job 2: Build and Push

This job runs after the Code Quality job succeeds:
1. Sets up Docker Buildx
2. Authenticates to GCP using the service account key
3. Configures Docker for Artifact Registry
4. Builds the Docker image
5. Pushes the image to Artifact Registry
6. Outputs the image reference for the next job

This job runs on both main branch pushes and pull requests, allowing verification of the build process without deployment.

### Job 3: Deploy to Cloud Run

This job runs after the Build and Push job succeeds, but only on the main branch:
1. Authenticates to GCP using the service account key
2. Deploys the image to Cloud Run
3. Outputs the deployment URL
4. Provides deployment status notifications

The Cloud Run service is configured with:
- 1GB memory
- 1 vCPU
- Min instances: 0 (scales to zero when not in use)
- Max instances: 10
- Port: 3000
- Environment: Production

### Conditional Execution

- Code Quality checks run on all triggers
- Build and Push runs only if Code Quality passes
- Deploy to Cloud Run runs only if Build and Push passes AND it's a push to the main branch

## Step 5: Verify the Deployment

After pushing to the main branch, you can verify the deployment:

1. Go to the "Actions" tab in your GitHub repository
2. Click on the latest workflow run
3. Check the logs for any errors
4. The deployment URL will be displayed in the "Show Output" step

## Security Considerations

- The service account has been granted only the minimum permissions needed for deployment
- The key file should never be committed to the repository
  - We've added entries to `.gitignore` to prevent accidental commits of key files:
    ```
    # GCP service account keys
    github-actions-key.json
    *-key.json
    *-credentials.json
    ```
- The key can be rotated by creating a new key and updating the GitHub secret
- Consider setting an expiration date on the key and rotating it regularly

## Troubleshooting

If you encounter issues with the deployment:

1. Check the GitHub Actions logs for detailed error messages
2. Verify that the service account has the correct permissions
3. Ensure the Artifact Registry repository exists
4. Check that the Cloud Run service is configured correctly

## Additional Resources

- [GitHub Actions for GCP documentation](https://github.com/google-github-actions/auth)
- [Cloud Run deployment documentation](https://cloud.google.com/run/docs/deploying)
- [GCP service account best practices](https://cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys)
