# Troubleshooting Artifact Registry Issues

This document provides guidance on troubleshooting and resolving issues with Google Cloud Platform's Artifact Registry, specifically for the Testero frontend deployment workflow.

## Common Error: 404 Not Found When Pushing to Artifact Registry

If you encounter an error like this when running your deployment workflow:

```
ERROR: failed to push ***-docker.pkg.dev/***/***/frontend:fafb0c929b30530701c6648200bd7fc3593ddbba: failed to authorize: failed to fetch oauth token: unexpected status from GET request to https://***-docker.pkg.dev/v2/token?scope=repository%3A***%2F***%2Ffrontend%3Apull%2Cpush&service=***-docker.pkg.dev: 404 Not Found
```

This indicates one of the following issues:

1. The Artifact Registry repository doesn't exist
2. The repository exists in a different region than specified
3. The service account doesn't have the necessary permissions
4. The Artifact Registry API is not enabled
5. There's a mismatch between GitHub secrets and actual GCP configuration

## Using the Troubleshooting Script

We've created a comprehensive troubleshooting script that will help identify and fix these issues. The script checks for:

- Artifact Registry API status
- Repository existence and configuration
- Service account permissions
- Docker authentication with Artifact Registry
- GitHub Actions secrets configuration

### Running the Script

```bash
# Make the script executable (if not already)
chmod +x scripts/troubleshoot-artifact-registry.sh

# Run the script
./scripts/troubleshoot-artifact-registry.sh
```

The script will guide you through the troubleshooting process with interactive prompts and will automatically fix issues when possible.

## Manual Troubleshooting Steps

If you prefer to troubleshoot manually, follow these steps:

### 1. Check if the Artifact Registry API is enabled

```bash
gcloud services list --enabled | grep artifactregistry.googleapis.com
```

If not enabled, enable it:

```bash
gcloud services enable artifactregistry.googleapis.com
```

### 2. Verify the repository exists

```bash
# Replace REGION and REPOSITORY_NAME with your values
gcloud artifacts repositories describe REPOSITORY_NAME --location=REGION
```

If it doesn't exist, create it:

```bash
gcloud artifacts repositories create REPOSITORY_NAME \
  --repository-format=docker \
  --location=REGION \
  --description="Docker repository for Testero frontend images"
```

Note: Lifecycle policies (for automatic cleanup of old images) need to be configured manually in the GCP Console. The previous scripts attempted to set these up automatically, but this feature is not available in the standard gcloud CLI.

### 3. Check service account permissions

```bash
# Get the IAM policy
gcloud projects get-iam-policy PROJECT_ID

# Look for the service account and its roles
# It should have at least:
# - roles/artifactregistry.admin
# - roles/run.admin
# - roles/iam.serviceAccountUser
```

If permissions are missing, add them:

```bash
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/artifactregistry.admin"
```

### 4. Test Docker authentication

```bash
# Configure Docker for Artifact Registry
gcloud auth configure-docker REGION-docker.pkg.dev

# Try a manual push
docker build -t REGION-docker.pkg.dev/PROJECT_ID/REPOSITORY_NAME/test:latest .
docker push REGION-docker.pkg.dev/PROJECT_ID/REPOSITORY_NAME/test:latest
```

### 5. Verify GitHub secrets

Ensure these GitHub secrets are correctly set:
- `GCP_PROJECT_ID`: Your Google Cloud project ID
- `GCP_REGION`: The region where your Artifact Registry is located
- `ARTIFACT_REPOSITORY`: The name of your Artifact Registry repository
- `SERVICE_NAME`: The name of your Cloud Run service
- `GCP_SA_KEY`: The service account key JSON file content

## Fixing Dockerfile Warnings

You may also see warnings about the Dockerfile format:

```
LegacyKeyValueFormat: "ENV key=value" should be used instead of legacy "ENV key value" format
```

To fix these, update your Dockerfile to use the recommended format:

Change from:
```dockerfile
ENV KEY VALUE
```

To:
```dockerfile
ENV KEY=VALUE
```

For example:
```dockerfile
# Before
ENV NODE_ENV production
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# After
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
```

## Recreating the Service Account Key

If you suspect issues with the service account key, you can create a new one:

```bash
# Create a new key
gcloud iam service-accounts keys create new-key.json \
  --iam-account=github-actions-deployer@PROJECT_ID.iam.gserviceaccount.com

# Update the GitHub secret with the contents of this new key
# (Copy the entire contents of new-key.json to the GCP_SA_KEY secret)
```

## Additional Resources

- [Artifact Registry documentation](https://cloud.google.com/artifact-registry/docs)
- [GitHub Actions for GCP documentation](https://github.com/google-github-actions/auth)
- [Cloud Run deployment documentation](https://cloud.google.com/run/docs/deploying)
- [GCP service account best practices](https://cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys)
