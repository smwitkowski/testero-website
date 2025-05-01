 # GCP Artifact Registry Setup for Docker Images

This document provides detailed information about the Artifact Registry repository used for storing Docker images in the Testero project.

## Repository Details

- **Name**: testero
- **Region**: us-central1
- **Format**: Docker
- **Full Path**: us-central1-docker.pkg.dev/[PROJECT_ID]/testero
- **Purpose**: Stores Docker images for the Testero frontend application

## Setup Instructions

We've provided a script to create and configure the Artifact Registry repository:

```bash
# Make the script executable
chmod +x scripts/setup-artifact-registry.sh

# Run the script
./scripts/setup-artifact-registry.sh
```

This script will:
1. Check if the Artifact Registry API is enabled and enable it if necessary
2. Check if the repository already exists
3. Create a Docker repository named `testero` in the us-central1 region if it doesn't exist
4. Set up lifecycle policies for automatic cleanup

## Lifecycle Policies

The repository should be configured with the following lifecycle policies (these need to be set up manually in the GCP Console):

1. **keep-recent-versions**:
   - Action: DELETE
   - Condition: `versionCount>10 AND tag!~^latest$ AND tag!~^v[0-9]+\.[0-9]+\.[0-9]+$`
   - Description: Keeps only the 10 most recent versions of each image, excluding images tagged as 'latest' or with semantic version tags (e.g., v1.2.3)

2. **cleanup-untagged**:
   - Action: DELETE
   - Condition: `tag='' AND createTime<-P14D`
   - Description: Removes untagged images that are older than 14 days

These policies help manage storage costs and keep the repository clean by automatically removing old and unused images.

**Note**: The setup script previously attempted to set these policies automatically, but this feature is not available in the standard gcloud CLI. You'll need to configure these policies manually through the GCP Console.

## Usage

### Pushing Images Manually

To push Docker images to the repository manually:

```bash
# Configure Docker to use Google Cloud as a credential helper
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build and tag your image
docker build -t us-central1-docker.pkg.dev/[PROJECT_ID]/testero/frontend:[TAG] .

# Push the image to Artifact Registry
docker push us-central1-docker.pkg.dev/[PROJECT_ID]/testero/frontend:[TAG]
```

Replace `[PROJECT_ID]` with your GCP project ID and `[TAG]` with your desired image tag.

### GitHub Actions Integration

The GitHub Actions workflow automatically builds and pushes Docker images to this repository. The workflow is configured in `.github/workflows/deploy-to-cloud-run.yml`.

The workflow:
1. Authenticates to Google Cloud using a service account
2. Configures Docker for Artifact Registry
3. Builds the Docker image
4. Pushes the image to the Artifact Registry repository
5. Deploys the image to Cloud Run

#### Required GitHub Secrets

For the GitHub Actions workflow to access the Artifact Registry, you need to set up the following secrets in your GitHub repository:

- `GCP_PROJECT_ID`: Your Google Cloud project ID
- `GCP_SA_KEY`: The service account key JSON file content
- `GCP_REGION`: The region where your Artifact Registry is located (e.g., `us-central1`)
- `ARTIFACT_REPOSITORY`: The name of your Artifact Registry repository (e.g., `testero`)
- `SERVICE_NAME`: The name of your Cloud Run service (e.g., `testero-frontend`)

To add these secrets:
1. Go to your GitHub repository
2. Navigate to Settings > Secrets and variables > Actions
3. Click "New repository secret"
4. Add each secret with its corresponding value

### Viewing Images in Artifact Registry

To view the images in the repository:

1. Go to the [GCP Console](https://console.cloud.google.com/)
2. Navigate to Artifact Registry > Repositories
3. Click on the "testero" repository
4. Browse the images and tags

## Access Control

Access to the Artifact Registry repository is managed through IAM roles:

- The GitHub Actions service account has the `artifactregistry.admin` role, allowing it to push and manage images
- Other team members may need the following roles:
  - `artifactregistry.reader`: To pull images
  - `artifactregistry.writer`: To push images
  - `artifactregistry.admin`: To manage the repository and its policies

To grant access to a user or service account:

```bash
gcloud artifacts repositories add-iam-policy-binding testero \
  --location=us-central1 \
  --member=user:user@example.com \
  --role=roles/artifactregistry.reader
```

## Best Practices

1. **Use specific tags**: Always tag your images with specific versions or commit hashes rather than just using 'latest'
2. **Use semantic versioning**: For release images, use semantic version tags (e.g., v1.2.3)
3. **Clean up unused images**: Although lifecycle policies automatically clean up old images, manually delete images that are no longer needed
4. **Scan for vulnerabilities**: Regularly scan your images for security vulnerabilities

## Troubleshooting

If you encounter issues with the Artifact Registry:

1. **Authentication issues**:
   - Run `gcloud auth configure-docker us-central1-docker.pkg.dev` to refresh credentials
   - Check that your service account has the necessary permissions

2. **Push failures**:
   - Verify that the repository exists
   - Check that you have the correct permissions
   - Ensure your Docker image is built correctly

3. **Pull failures**:
   - Verify that the image exists in the repository
   - Check that you have the correct permissions
   - Ensure you're using the correct image path and tag
