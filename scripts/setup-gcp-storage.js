#!/usr/bin/env node

/**
 * This script sets up a GCP Cloud Storage bucket with CDN and CORS configuration
 * for optimized image delivery.
 * 
 * Usage:
 *   node scripts/setup-gcp-storage.js
 * 
 * Environment variables:
 *   GCP_STORAGE_BUCKET_NAME - The name of the bucket to create (default: testero-media)
 *   GCP_PROJECT_ID - The GCP project ID
 *   GCP_KEY_FILE_PATH - Path to the service account key file (optional)
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { Storage } = require('@google-cloud/storage');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// Configuration
const BUCKET_NAME = process.env.GCP_STORAGE_BUCKET_NAME || 'testero-media';
const PROJECT_ID = process.env.GCP_PROJECT_ID;
const KEY_FILE_PATH = process.env.GCP_KEY_FILE_PATH;

// Debug environment variables
console.log('Environment Variables:');
console.log('- GCP_STORAGE_BUCKET_NAME:', BUCKET_NAME);
console.log('- GCP_PROJECT_ID:', PROJECT_ID);
console.log('- GCP_KEY_FILE_PATH:', KEY_FILE_PATH ? 'Set' : 'Not set');

// Validate required environment variables
if (!PROJECT_ID) {
  console.error('Error: GCP_PROJECT_ID environment variable is required');
  process.exit(1);
}

// Initialize GCP Storage client
const storageOptions = KEY_FILE_PATH ? { keyFilename: KEY_FILE_PATH } : {};
const storage = new Storage(storageOptions);

/**
 * Create a GCP Cloud Storage bucket if it doesn't exist
 */
async function createBucket() {
  try {
    console.log(`Checking if bucket "${BUCKET_NAME}" exists...`);
    
    // Check if bucket exists
    const [exists] = await storage.bucket(BUCKET_NAME).exists();
    
    if (exists) {
      console.log(`Bucket "${BUCKET_NAME}" already exists.`);
      return;
    }
    
    // Create the bucket
    console.log(`Creating bucket "${BUCKET_NAME}"...`);
    
    const [bucket] = await storage.createBucket(BUCKET_NAME, {
      location: 'us-central1',
      storageClass: 'STANDARD',
      // Enable uniform bucket-level access
      iamConfiguration: {
        uniformBucketLevelAccess: {
          enabled: true,
        },
      },
    });
    
    console.log(`Bucket "${BUCKET_NAME}" created successfully.`);
    
    // Make the bucket public
    await makePublic();
  } catch (error) {
    console.error('Error creating bucket:', error);
    process.exit(1);
  }
}

/**
 * Make the bucket publicly accessible
 */
async function makePublic() {
  try {
    console.log(`Making bucket "${BUCKET_NAME}" publicly accessible...`);
    
    // Get the bucket
    const bucket = storage.bucket(BUCKET_NAME);
    
    // Make the bucket public by updating the IAM policy
    const [policy] = await bucket.iam.getPolicy({ requestedPolicyVersion: 3 });
    
    // Set policy version
    policy.version = 3;
    
    // Add the allUsers member to the policy with objectViewer role
    const bindings = policy.bindings || [];
    const objectViewerBinding = bindings.find(binding => binding.role === 'roles/storage.objectViewer');
    
    if (objectViewerBinding) {
      if (!objectViewerBinding.members.includes('allUsers')) {
        objectViewerBinding.members.push('allUsers');
      }
    } else {
      bindings.push({
        role: 'roles/storage.objectViewer',
        members: ['allUsers']
      });
    }
    
    policy.bindings = bindings;
    
    // Set the updated policy
    await bucket.iam.setPolicy(policy);
    
    // Alternative method: Set public access at the object level when uploading
    console.log(`Bucket "${BUCKET_NAME}" is now publicly accessible.`);
  } catch (error) {
    console.error('Error making bucket public:', error);
    console.log('Note: You may need to manually set the bucket to be publicly accessible in the GCP Console.');
    console.log('Go to https://console.cloud.google.com/storage/browser and select your bucket.');
    console.log('Then click on "Permissions" and add "allUsers" with the "Storage Object Viewer" role.');
  }
}

/**
 * Configure CORS for the bucket
 */
async function configureCors() {
  try {
    console.log(`Configuring CORS for bucket "${BUCKET_NAME}"...`);
    
    // Set CORS configuration
    await storage.bucket(BUCKET_NAME).setCorsConfiguration([
      {
        origin: ['*'],
        method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'],
        responseHeader: ['Content-Type', 'x-goog-meta-*', 'Content-Disposition'],
        maxAgeSeconds: 3600,
      },
    ]);
    
    console.log(`CORS configured for bucket "${BUCKET_NAME}".`);
  } catch (error) {
    console.error('Error configuring CORS:', error);
    process.exit(1);
  }
}

/**
 * Configure lifecycle policy for the bucket
 */
async function configureLifecycle() {
  try {
    console.log(`Configuring lifecycle policy for bucket "${BUCKET_NAME}"...`);
    
    // Get the bucket
    const bucket = storage.bucket(BUCKET_NAME);
    
    // Set lifecycle configuration using the correct method
    const rules = [
      {
        action: {
          type: 'Delete',
        },
        condition: {
          age: 365, // Delete objects older than 1 year
          isLive: true,
          matchesStorageClass: ['STANDARD'],
        },
      },
      {
        action: {
          type: 'SetStorageClass',
          storageClass: 'NEARLINE',
        },
        condition: {
          age: 30, // Move to Nearline after 30 days
          matchesStorageClass: ['STANDARD'],
        },
      },
    ];
    
    // Use the setMetadata method to set lifecycle rules
    await bucket.setMetadata({
      lifecycle: {
        rule: rules,
      },
    });
    
    console.log(`Lifecycle policy configured for bucket "${BUCKET_NAME}".`);
  } catch (error) {
    console.error('Error configuring lifecycle policy:', error);
    console.log('Note: You may need to manually configure lifecycle policies in the GCP Console.');
    console.log('Go to https://console.cloud.google.com/storage/browser and select your bucket.');
    console.log('Then click on "Lifecycle" and add the rules manually.');
  }
}

/**
 * Enable Cloud CDN for the bucket
 */
async function enableCdn() {
  try {
    console.log(`Enabling Cloud CDN for bucket "${BUCKET_NAME}"...`);
    
    // Check if gcloud command is available
    try {
      await execAsync('gcloud --version', { timeout: 5000 });
    } catch (error) {
      console.error('Error: gcloud command not found or not responding.');
      console.log('You need to install and configure the Google Cloud SDK (gcloud) to enable CDN.');
      console.log('See: https://cloud.google.com/sdk/docs/install');
      console.log('Skipping CDN setup...');
      return;
    }
    
    // Create a backend bucket
    const backendBucketName = `${BUCKET_NAME}-backend`;
    
    // Check if backend bucket exists with a timeout
    try {
      const { stdout } = await execAsync(
        `gcloud compute backend-buckets describe ${backendBucketName} --project=${PROJECT_ID} --format=json`,
        { timeout: 30000 } // 30 seconds timeout
      );
      console.log(`Backend bucket "${backendBucketName}" already exists.`);
    } catch (error) {
      // Check if it's a timeout error
      if (error.killed && error.signal === 'SIGTERM') {
        console.error('Error: gcloud command timed out. The command may be taking too long to execute.');
        console.log('You can try running the command manually:');
        console.log(`gcloud compute backend-buckets describe ${backendBucketName} --project=${PROJECT_ID} --format=json`);
        console.log('Skipping CDN setup...');
        return;
      }
      
      // If the error is because the backend bucket doesn't exist, create it
      if (error.stderr && error.stderr.includes('not found')) {
        console.log(`Creating backend bucket "${backendBucketName}"...`);
        try {
          await execAsync(
            `gcloud compute backend-buckets create ${backendBucketName} --gcs-bucket-name=${BUCKET_NAME} --enable-cdn --project=${PROJECT_ID}`,
            { timeout: 60000 } // 60 seconds timeout
          );
          console.log(`Backend bucket "${backendBucketName}" created with CDN enabled.`);
        } catch (createError) {
          // Check if it's a timeout error
          if (createError.killed && createError.signal === 'SIGTERM') {
            console.error('Error: gcloud command timed out while creating backend bucket.');
            console.log('You can try running the command manually:');
            console.log(`gcloud compute backend-buckets create ${backendBucketName} --gcs-bucket-name=${BUCKET_NAME} --enable-cdn --project=${PROJECT_ID}`);
          } else {
            console.error('Error creating backend bucket:', createError.message || createError);
          }
          console.log('Skipping CDN setup...');
          return;
        }
      } else {
        console.error('Error checking if backend bucket exists:', error.message || error);
        console.log('Skipping CDN setup...');
        return;
      }
    }
    
    console.log(`Cloud CDN enabled for bucket "${BUCKET_NAME}".`);
    console.log(`Note: To use a custom domain, you'll need to create a URL map and set up SSL certificates.`);
  } catch (error) {
    console.error('Error enabling Cloud CDN:', error.message || error);
    console.log('Note: You may need to install and configure the Google Cloud SDK (gcloud) to enable CDN.');
    console.log('See: https://cloud.google.com/sdk/docs/install');
    console.log('Skipping CDN setup...');
  }
}

/**
 * Main function to run the script
 */
async function main() {
  console.log('Setting up GCP Cloud Storage bucket with CDN...');
  console.log(`Bucket Name: ${BUCKET_NAME}`);
  console.log(`Project ID: ${PROJECT_ID}`);
  
  // Create the bucket
  await createBucket();
  
  // Configure CORS
  await configureCors();
  
  // Configure lifecycle policy
  await configureLifecycle();
  
  // Enable Cloud CDN
  await enableCdn();
  
  console.log('\nSetup complete!');
  console.log(`Your bucket is available at: https://storage.googleapis.com/${BUCKET_NAME}/`);
  console.log('To use a custom domain with CDN, follow these steps:');
  console.log('1. Create a URL map pointing to your backend bucket');
  console.log('2. Set up an SSL certificate for your domain');
  console.log('3. Create a target HTTPS proxy with the certificate');
  console.log('4. Create a forwarding rule to direct traffic to the proxy');
  console.log('5. Update your DNS to point to the forwarding rule IP');
  console.log('\nFor more information, see: https://cloud.google.com/cdn/docs/setting-up-cdn-with-bucket');
}

// Run the script
main().catch(console.error);
