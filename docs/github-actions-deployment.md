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
5. Add another secret:
   - Name: `GCP_PROJECT_ID`
   - Value: *[Your GCP project ID]*

## Step 3: GitHub Actions Workflow

We've created a GitHub Actions workflow file at `.github/workflows/deploy-to-cloud-run.yml`. This workflow:

1. Triggers on pushes to the main branch (configurable)
2. Authenticates to GCP using the service account key
3. Builds a Docker image of the application
4. Pushes the image to Artifact Registry
5. Deploys the image to Cloud Run

The workflow uses the same configuration as our existing Cloud Run service:
- 1GB memory
- 1 vCPU
- Min instances: 0
- Max instances: 10
- Port: 3000
- Environment: Production

## Step 4: Verify the Deployment

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
