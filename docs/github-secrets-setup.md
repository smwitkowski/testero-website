# GitHub Secrets Setup for GCP Deployment

This document provides detailed information about the GitHub secrets required for deploying the Testero frontend to Google Cloud Platform (GCP) using GitHub Actions.

## Required Secrets

The following secrets must be configured in your GitHub repository for the deployment workflow to function correctly:

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `GCP_SA_KEY` | The service account key JSON file content | `{"type": "service_account", "project_id": "testero-project", ...}` |
| `GCP_PROJECT_ID` | Your Google Cloud project ID | `testero-project` |
| `GCP_REGION` | The region where your GCP resources are located | `us-central1` |
| `ARTIFACT_REPOSITORY` | The name of your Artifact Registry repository | `testero` |
| `SERVICE_NAME` | The name of your Cloud Run service | `testero-frontend` |

## Setting Up Secrets

To add these secrets to your GitHub repository:

1. Go to your GitHub repository
2. Navigate to Settings > Secrets and variables > Actions
3. Click "New repository secret"
4. Add each secret with its corresponding value

## Secret Details

### GCP_SA_KEY

This is the most sensitive secret and contains the full JSON content of the service account key file. This key grants GitHub Actions the permissions needed to deploy to GCP.

To generate this key:

1. Run the service account creation script:
   ```bash
   chmod +x scripts/create-github-actions-service-account.sh
   ./scripts/create-github-actions-service-account.sh
   ```

2. The script will generate a file named `github-actions-key.json` in the `.local/` folder
3. Copy the entire contents of this file (including all curly braces, quotes, etc.)
4. Paste this content as the value for the `GCP_SA_KEY` secret

**Security Note**: This key grants access to your GCP resources. Never commit this key to your repository, share it publicly, or include it in logs. The `.local/` folder is in `.gitignore` to prevent accidental commits.

### GCP_PROJECT_ID

This is your Google Cloud project identifier. You can find this in the GCP Console dashboard or by running:

```bash
gcloud config get-value project
```

### GCP_REGION

This is the GCP region where your resources are deployed. The default value used in the scripts is `us-central1`. This should match the region where your Artifact Registry repository and Cloud Run service are located.

### ARTIFACT_REPOSITORY

This is the name of your Artifact Registry repository where Docker images are stored. The default value used in the scripts is `testero`.

### SERVICE_NAME

This is the name of your Cloud Run service. The default value used in the scripts is `testero-frontend`.

## Rotating Secrets

For security best practices, you should periodically rotate the service account key:

1. Create a new key for the service account:
   ```bash
   gcloud iam service-accounts keys create new-key.json --iam-account=github-actions-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com
   ```

2. Update the `GCP_SA_KEY` secret in GitHub with the contents of the new key
3. Delete the old key:
   ```bash
   gcloud iam service-accounts keys list --iam-account=github-actions-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com
   gcloud iam service-accounts keys delete KEY_ID --iam-account=github-actions-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com
   ```

## Troubleshooting

If you encounter issues with the GitHub Actions deployment:

1. **Authentication failures**:
   - Verify that the `GCP_SA_KEY` secret contains the complete and valid JSON content
   - Check that the service account has the necessary permissions (Cloud Run Admin, Artifact Registry Admin, Service Account User)
   - Ensure the key hasn't been revoked or expired

2. **Resource not found errors**:
   - Verify that `GCP_PROJECT_ID`, `GCP_REGION`, `ARTIFACT_REPOSITORY`, and `SERVICE_NAME` are correct
   - Check that these resources actually exist in your GCP project
   - Ensure the service account has access to these resources

3. **Workflow failures**:
   - Check the GitHub Actions logs for detailed error messages
   - Verify that all required secrets are set correctly
   - Test the deployment manually to isolate any issues

## Related Documentation

- [GitHub Actions Deployment](./github-actions-deployment.md)
- [Artifact Registry Setup](./artifact-registry-setup.md)
- [Deployment Guide](./deployment/deployment-guide.md)
