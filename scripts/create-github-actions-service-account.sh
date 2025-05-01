#!/bin/bash
# Script to create a GCP service account for GitHub Actions deployment

# Exit on error
set -e

# Configuration - modify these variables as needed
PROJECT_ID=$(gcloud config get-value project)
SERVICE_ACCOUNT_NAME="github-actions-deployer"
SERVICE_ACCOUNT_DISPLAY_NAME="GitHub Actions Deployment Service Account"
KEY_FILE_PATH="github-actions-key.json"

echo "Setting up service account for GitHub Actions deployment in project: $PROJECT_ID"

# Get the service account email
SERVICE_ACCOUNT_EMAIL="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"

# Check if the service account already exists
if gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" &>/dev/null; then
  echo "Service account $SERVICE_ACCOUNT_EMAIL already exists. Skipping creation."
else
  # Create the service account
  echo "Creating service account: $SERVICE_ACCOUNT_NAME"
  gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --display-name="$SERVICE_ACCOUNT_DISPLAY_NAME" \
    --description="Service account for GitHub Actions to deploy to Cloud Run"
  
  echo "Service account created: $SERVICE_ACCOUNT_EMAIL"
  
  # Wait for the service account to be fully created and propagated
  echo "Waiting for service account to be fully propagated (10 seconds)..."
  sleep 10
  
  # Verify the service account exists
  echo "Verifying service account exists..."
  if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" &>/dev/null; then
    echo "ERROR: Service account $SERVICE_ACCOUNT_EMAIL was not created properly or needs more time to propagate."
    echo "Please wait a few minutes and try running the script again."
    exit 1
  fi
fi

# Assign required IAM roles
echo "Assigning required IAM roles..."

# Cloud Run Admin - to deploy to Cloud Run
echo "Adding Cloud Run Admin role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/run.admin" \
  --quiet

# Storage Admin - for Artifact Registry access
echo "Adding Storage Admin role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/artifactregistry.admin" \
  --quiet

# Service Account User - to act as the service account
echo "Adding Service Account User role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/iam.serviceAccountUser" \
  --quiet

# Create and download a JSON key file
echo "Creating and downloading key file to: $KEY_FILE_PATH"
gcloud iam service-accounts keys create $KEY_FILE_PATH \
  --iam-account="$SERVICE_ACCOUNT_EMAIL"

echo "Service account created successfully!"
echo "Key file downloaded to: $KEY_FILE_PATH"
echo ""
echo "IMPORTANT: Store this key file securely and add it as a GitHub secret."
echo "Never commit this key file to your repository."
echo ""
echo "Next steps:"
echo "1. Add the key file content as a GitHub secret named 'GCP_SA_KEY'"
echo "2. Create a GitHub Actions workflow file as described in the documentation"
