# GCP Cloud Storage Utilities

This directory contains utility functions for working with Google Cloud Storage in the Testero frontend.

## Overview

The `storage.ts` module provides a set of functions for interacting with GCP Cloud Storage, including:

- Uploading files and buffers
- Getting signed URLs and CDN URLs
- Managing files (checking existence, deleting)
- Configuring CORS for the bucket

## Usage

### Initialization

The storage client is initialized automatically when you use any of the utility functions. It supports two authentication methods:

1. Service account key file (for local development)
2. Application Default Credentials (for production/GCP environments)

```typescript
import { initStorage } from '../lib/gcp/storage';

// Initialize the storage client
const storage = initStorage();
```

### Uploading Files

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

### Getting URLs

```typescript
import { getCdnUrl, getSignedUrl } from '../lib/gcp/storage';

// Get a CDN URL
const cdnUrl = getCdnUrl('images/logo.png');

// Get a signed URL (for private files)
const signedUrl = await getSignedUrl('private/document.pdf', {
  action: 'read',
  expires: 3600, // 1 hour
});
```

### Managing Files

```typescript
import { fileExists, deleteFile } from '../lib/gcp/storage';

// Check if a file exists
const exists = await fileExists('images/logo.png');

// Delete a file
await deleteFile('images/old-logo.png');
```

### Configuring CORS

```typescript
import { configureBucketCors } from '../lib/gcp/storage';

// Configure CORS for the bucket
await configureBucketCors(
  ['https://testero.ai', 'http://localhost:3000'],
  ['GET', 'HEAD', 'PUT', 'POST'],
  3600
);
```

## Environment Variables

The following environment variables are used by the GCP Cloud Storage utilities:

- `GCP_STORAGE_BUCKET_NAME`: The name of the GCP Storage bucket (default: 'testero-media')
- `GCP_CDN_URL`: The URL of the CDN endpoint (default: 'https://media.testero.ai')
- `GCP_KEY_FILE_PATH`: Path to the service account key file (optional)
- `USE_GCP_STORAGE`: Whether to use GCP Cloud Storage (default: false)

## Setup

Before using these utilities, make sure to:

1. Run the setup script to create and configure the GCP Cloud Storage bucket:
   ```bash
   npm run setup:gcp-storage
   ```

2. Set the appropriate environment variables in `.env.local`

## Related Documentation

For more detailed information, see:

- [GCP Cloud Storage with CDN Documentation](../../docs/gcp-cloud-storage-cdn.md)
- [Google Cloud Storage Documentation](https://cloud.google.com/storage/docs)
- [Cloud CDN Documentation](https://cloud.google.com/cdn/docs)
