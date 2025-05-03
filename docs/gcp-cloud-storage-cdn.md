# GCP Cloud Storage with CDN for Image Optimization

This document explains how to set up and use Google Cloud Storage with Cloud CDN for optimized image delivery in the Testero frontend.

## Overview

We've implemented a solution to store and serve optimized images using Google Cloud Storage (GCS) with Cloud CDN. This approach provides several benefits:

- **Global Edge Caching**: Faster image loading for users worldwide
- **WebP Format Support**: Smaller file sizes (30% smaller than PNG/JPG)
- **Responsive Images**: Multiple sizes for different devices
- **Proper Cache Control**: Optimal caching for returning visitors
- **Reduced Origin Load**: Less traffic to our main servers

## Setup Instructions

### Prerequisites

1. Google Cloud Platform account with billing enabled
2. `gcloud` CLI installed and configured
3. Appropriate GCP permissions (Storage Admin, Compute Admin)

### Step 1: Configure Environment Variables

Add the following environment variables to your `.env.local` file for local development:

```
# GCP Cloud Storage Configuration
USE_GCP_STORAGE=true
GCP_STORAGE_BUCKET_NAME=testero-media
GCP_CDN_URL=https://media.testero.ai
GCP_PROJECT_ID=your-project-id
GCP_KEY_FILE_PATH=/path/to/service-account-key.json
```

For production, these variables should be set in your CI/CD pipeline or cloud environment.

### Step 2: Create a Service Account (for local development)

1. Go to the [GCP Console](https://console.cloud.google.com/)
2. Navigate to IAM & Admin > Service Accounts
3. Create a new service account with the following roles:
   - Storage Admin
   - Storage Object Admin
   - Compute Admin (for CDN configuration)
4. Create and download a JSON key file
5. Set the path to this file in the `GCP_KEY_FILE_PATH` environment variable

### Step 3: Run the Setup Script

We've provided a script to automate the setup process:

```bash
npm run setup:gcp-storage
```

This script will:
1. Create a GCS bucket if it doesn't exist
2. Configure public access
3. Set up CORS for web access
4. Configure lifecycle policies
5. Enable Cloud CDN

### Step 4: Configure DNS (for production)

To use a custom domain (e.g., `media.testero.ai`):

1. Create a URL map pointing to your backend bucket
2. Set up an SSL certificate for your domain
3. Create a target HTTPS proxy with the certificate
4. Create a forwarding rule to direct traffic to the proxy
5. Update your DNS to point to the forwarding rule IP

## Usage

### Generating and Uploading Images

The image generation script (`scripts/generate-social-images.js`) has been updated to:

1. Generate optimized images in both JPEG/PNG and WebP formats
2. Upload them to GCP Cloud Storage with proper cache headers
3. Create a JSON file with CDN URLs for reference

To generate and upload images:

```bash
npm run generate:social-images
```

### Using CDN URLs in SEO Metadata

The SEO implementation (`lib/seo/seo.ts`) has been updated to use CDN URLs when available. It will:

1. Check for the existence of `image-urls.json`
2. Use CDN URLs for Open Graph, Twitter, and structured data images
3. Fall back to local paths if CDN URLs are not available

### Manually Uploading Images

You can use the utility functions in `lib/gcp/storage.ts` to upload images programmatically:

```typescript
import { uploadFile, uploadBuffer } from '../lib/gcp/storage';

// Upload a file
const fileUrl = await uploadFile(
  '/path/to/local/image.jpg',
  'destination/image.jpg',
  {
    contentType: 'image/jpeg',
    cacheControl: 'public, max-age=31536000',
  }
);

// Upload a buffer
const buffer = await sharp(imageData).jpeg().toBuffer();
const bufferUrl = await uploadBuffer(
  buffer,
  'destination/image.jpg',
  {
    contentType: 'image/jpeg',
  }
);
```

## Docker Configuration

The Dockerfile has been updated to support GCP Cloud Storage:

1. Added build arguments for GCP configuration
2. Added environment variables for the build stage
3. Added support for service account key file

When building the Docker image, you can pass GCP configuration:

```bash
docker build \
  --build-arg GCP_STORAGE_BUCKET_NAME=testero-media \
  --build-arg GCP_CDN_URL=https://media.testero.ai \
  --build-arg USE_GCP_STORAGE=true \
  --build-arg GCP_PROJECT_ID=your-project-id \
  --build-arg GCP_SERVICE_ACCOUNT_KEY="$(cat /path/to/service-account-key.json)" \
  -t testero-frontend .
```

## Troubleshooting

### Common Issues

1. **Permission Denied**: Ensure your service account has the necessary permissions
2. **Bucket Not Found**: Check that the bucket name is correct and exists
3. **CDN Not Working**: Verify that Cloud CDN is properly enabled
4. **CORS Issues**: Check the CORS configuration in the bucket settings

### Debugging

1. Check the logs in the GCP Console
2. Run the image generation script with debugging:
   ```bash
   NODE_DEBUG=http,https npm run generate:social-images
   ```
3. Verify the bucket permissions in the GCP Console

## Best Practices

1. **Use WebP Format**: Always generate WebP versions of images for better performance
2. **Set Proper Cache Headers**: Use long cache times for static assets
3. **Use Descriptive Filenames**: Include relevant keywords for SEO
4. **Generate Multiple Sizes**: Create responsive images for different devices
5. **Implement Lazy Loading**: Use the `loading="lazy"` attribute for images below the fold

## Resources

- [Google Cloud Storage Documentation](https://cloud.google.com/storage/docs)
- [Cloud CDN Documentation](https://cloud.google.com/cdn/docs)
- [WebP Format](https://developers.google.com/speed/webp)
- [Image Optimization Best Practices](https://web.dev/fast/#optimize-your-images)
