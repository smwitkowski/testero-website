#!/bin/bash
# Script to set up GCP Artifact Registry for Docker images

# Exit on error
set -e

# Configuration - modify these variables as needed
PROJECT_ID=$(gcloud config get-value project)
REPOSITORY_NAME="testero"
REGION="us-central1"
DESCRIPTION="Docker repository for Testero frontend images"

echo "Setting up Artifact Registry repository in project: $PROJECT_ID"

# Check if the Artifact Registry API is enabled
if ! gcloud services list --enabled | grep -q artifactregistry.googleapis.com; then
  echo "Enabling Artifact Registry API..."
  gcloud services enable artifactregistry.googleapis.com
fi

# Check if the repository already exists
if gcloud artifacts repositories describe $REPOSITORY_NAME --location=$REGION &>/dev/null; then
  echo "Repository $REPOSITORY_NAME already exists in $REGION. Skipping creation."
else
  # Create the Docker repository
  echo "Creating Docker repository: $REPOSITORY_NAME in $REGION"
  gcloud artifacts repositories create $REPOSITORY_NAME \
    --repository-format=docker \
    --location=$REGION \
    --description="$DESCRIPTION"
  
  echo "Repository created: $REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY_NAME"
fi

# Set up lifecycle policy for image cleanup
echo "Setting up lifecycle policy for automatic cleanup of old images..."
gcloud artifacts repositories update $REPOSITORY_NAME \
  --location=$REGION \
  --cleanup-policies=policy-name=keep-recent-versions,action=DELETE,condition="versionCount>10 AND tag!~^latest$ AND tag!~^v[0-9]+\.[0-9]+\.[0-9]+$"

# Add another policy to clean up untagged images older than 14 days
gcloud artifacts repositories update $REPOSITORY_NAME \
  --location=$REGION \
  --cleanup-policies=policy-name=cleanup-untagged,action=DELETE,condition="tag='' AND createTime<-P14D"

echo "Artifact Registry repository setup complete!"
echo ""
echo "Repository details:"
echo "- Name: $REPOSITORY_NAME"
echo "- Region: $REGION"
echo "- Full path: $REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY_NAME"
echo "- Lifecycle policies:"
echo "  - keep-recent-versions: Keep only the 10 most recent versions (excluding 'latest' and semantic version tags)"
echo "  - cleanup-untagged: Remove untagged images older than 14 days"
echo ""
echo "To push images to this repository:"
echo "1. Configure Docker: gcloud auth configure-docker $REGION-docker.pkg.dev"
echo "2. Tag your image: docker tag IMAGE_NAME $REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY_NAME/frontend:TAG"
echo "3. Push your image: docker push $REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY_NAME/frontend:TAG"
echo ""
echo "For GitHub Actions deployment, make sure to set up the following secrets:"
echo "- GCP_PROJECT_ID: $PROJECT_ID"
echo "- GCP_REGION: $REGION"
echo "- ARTIFACT_REPOSITORY: $REPOSITORY_NAME"
echo "- SERVICE_NAME: testero-frontend (or your service name)"
