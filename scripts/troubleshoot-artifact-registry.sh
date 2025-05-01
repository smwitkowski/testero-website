#!/bin/bash
# Script to troubleshoot Artifact Registry issues

# Exit on error
set -e

# Configuration - modify these variables as needed
PROJECT_ID=$(gcloud config get-value project)
REPOSITORY_NAME="testero"
REGION="us-central1"
SERVICE_ACCOUNT_NAME="github-actions-deployer"

echo "=== Artifact Registry Troubleshooting ==="
echo "Project ID: $PROJECT_ID"
echo "Repository Name: $REPOSITORY_NAME"
echo "Region: $REGION"
echo "Service Account: $SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"
echo ""

# Step 1: Check if the Artifact Registry API is enabled
echo "Step 1: Checking if Artifact Registry API is enabled..."
if gcloud services list --enabled | grep -q artifactregistry.googleapis.com; then
  echo "✅ Artifact Registry API is enabled"
else
  echo "❌ Artifact Registry API is NOT enabled"
  echo "Enabling Artifact Registry API..."
  gcloud services enable artifactregistry.googleapis.com
  echo "✅ Artifact Registry API has been enabled"
fi
echo ""

# Step 2: Check if the repository exists
echo "Step 2: Checking if repository exists..."
if gcloud artifacts repositories describe $REPOSITORY_NAME --location=$REGION &>/dev/null; then
  echo "✅ Repository '$REPOSITORY_NAME' exists in region '$REGION'"
  
  # Get repository details
  echo "Repository details:"
  gcloud artifacts repositories describe $REPOSITORY_NAME --location=$REGION
else
  echo "❌ Repository '$REPOSITORY_NAME' does NOT exist in region '$REGION'"
  echo "Would you like to create it? (y/n)"
  read -r create_repo
  if [[ "$create_repo" == "y" ]]; then
    echo "Creating Docker repository: $REPOSITORY_NAME in $REGION"
    gcloud artifacts repositories create $REPOSITORY_NAME \
      --repository-format=docker \
      --location=$REGION \
      --description="Docker repository for Testero frontend images"
    
    # Note: Lifecycle policies are not set up automatically
    # They need to be configured manually in the GCP Console
    echo "Note: Please set up lifecycle policies manually in the GCP Console"
    
    echo "✅ Repository created: $REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY_NAME"
  fi
fi
echo ""

# Step 3: Check service account permissions
echo "Step 3: Checking service account permissions..."
SERVICE_ACCOUNT_EMAIL="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"

# Check if the service account exists
if gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" &>/dev/null; then
  echo "✅ Service account '$SERVICE_ACCOUNT_EMAIL' exists"
  
  # Check if the service account has the necessary roles
  echo "Checking IAM roles..."
  
  # Get the IAM policy
  IAM_POLICY=$(gcloud projects get-iam-policy $PROJECT_ID --format=json)
  
  # Check for Artifact Registry Admin role
  if echo "$IAM_POLICY" | grep -q "serviceAccount:$SERVICE_ACCOUNT_EMAIL" && echo "$IAM_POLICY" | grep -q "roles/artifactregistry.admin"; then
    echo "✅ Service account has 'artifactregistry.admin' role"
  else
    echo "❌ Service account does NOT have 'artifactregistry.admin' role"
    echo "Adding 'artifactregistry.admin' role..."
    gcloud projects add-iam-policy-binding $PROJECT_ID \
      --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
      --role="roles/artifactregistry.admin" \
      --quiet
    echo "✅ Role 'artifactregistry.admin' added to service account"
  fi
  
  # Check for Cloud Run Admin role
  if echo "$IAM_POLICY" | grep -q "serviceAccount:$SERVICE_ACCOUNT_EMAIL" && echo "$IAM_POLICY" | grep -q "roles/run.admin"; then
    echo "✅ Service account has 'run.admin' role"
  else
    echo "❌ Service account does NOT have 'run.admin' role"
    echo "Adding 'run.admin' role..."
    gcloud projects add-iam-policy-binding $PROJECT_ID \
      --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
      --role="roles/run.admin" \
      --quiet
    echo "✅ Role 'run.admin' added to service account"
  fi
  
  # Check for Service Account User role
  if echo "$IAM_POLICY" | grep -q "serviceAccount:$SERVICE_ACCOUNT_EMAIL" && echo "$IAM_POLICY" | grep -q "roles/iam.serviceAccountUser"; then
    echo "✅ Service account has 'iam.serviceAccountUser' role"
  else
    echo "❌ Service account does NOT have 'iam.serviceAccountUser' role"
    echo "Adding 'iam.serviceAccountUser' role..."
    gcloud projects add-iam-policy-binding $PROJECT_ID \
      --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
      --role="roles/iam.serviceAccountUser" \
      --quiet
    echo "✅ Role 'iam.serviceAccountUser' added to service account"
  fi
else
  echo "❌ Service account '$SERVICE_ACCOUNT_EMAIL' does NOT exist"
  echo "Would you like to create it? (y/n)"
  read -r create_sa
  if [[ "$create_sa" == "y" ]]; then
    echo "Creating service account: $SERVICE_ACCOUNT_NAME"
    gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
      --display-name="GitHub Actions Deployment Service Account" \
      --description="Service account for GitHub Actions to deploy to Cloud Run"
    
    echo "Waiting for service account to be fully propagated (10 seconds)..."
    sleep 10
    
    echo "Adding required roles..."
    gcloud projects add-iam-policy-binding $PROJECT_ID \
      --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
      --role="roles/artifactregistry.admin" \
      --quiet
    
    gcloud projects add-iam-policy-binding $PROJECT_ID \
      --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
      --role="roles/run.admin" \
      --quiet
    
    gcloud projects add-iam-policy-binding $PROJECT_ID \
      --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
      --role="roles/iam.serviceAccountUser" \
      --quiet
    
    echo "✅ Service account created with required roles"
    
    echo "Would you like to create a new key for this service account? (y/n)"
    read -r create_key
    if [[ "$create_key" == "y" ]]; then
      KEY_FILE_PATH="github-actions-key.json"
      gcloud iam service-accounts keys create $KEY_FILE_PATH \
        --iam-account="$SERVICE_ACCOUNT_EMAIL"
      echo "✅ Key file created: $KEY_FILE_PATH"
      echo "IMPORTANT: Add this key to your GitHub secrets as GCP_SA_KEY"
    fi
  fi
fi
echo ""

# Step 4: Test Docker authentication
echo "Step 4: Testing Docker authentication with Artifact Registry..."
echo "Configuring Docker for Artifact Registry..."
gcloud auth configure-docker $REGION-docker.pkg.dev

echo "Would you like to test a Docker build and push? (y/n)"
read -r test_docker
if [[ "$test_docker" == "y" ]]; then
  # Create a simple test image
  echo "Creating a simple test image..."
  mkdir -p test-docker
  cat > test-docker/Dockerfile << EOF
FROM alpine:latest
CMD ["echo", "Hello, Artifact Registry!"]
EOF
  
  # Build and push the test image
  echo "Building test image..."
  docker build --load -t $REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY_NAME/test:latest test-docker/
  
  echo "Pushing test image to Artifact Registry..."
  docker push $REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY_NAME/test:latest
  
  # Clean up
  echo "Cleaning up..."
  rm -rf test-docker
  
  echo "✅ Test image successfully pushed to Artifact Registry"
fi
echo ""

# Step 5: Check GitHub Actions secrets
echo "Step 5: GitHub Actions secrets check"
echo "Please verify that the following GitHub secrets are set correctly:"
echo "- GCP_PROJECT_ID: $PROJECT_ID"
echo "- GCP_REGION: $REGION"
echo "- ARTIFACT_REPOSITORY: $REPOSITORY_NAME"
echo "- SERVICE_NAME: testero-frontend (or your service name)"
echo "- GCP_SA_KEY: [The JSON key file content]"
echo ""

echo "=== Troubleshooting Complete ==="
echo "If all checks passed and you've verified the GitHub secrets, the deployment should work."
echo "If you created a new repository or service account, make sure to update the GitHub secrets accordingly."
