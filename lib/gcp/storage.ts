import { Storage, UploadOptions, SaveOptions, GetSignedUrlConfig } from '@google-cloud/storage';

// Constants
export const BUCKET_NAME = process.env.GCP_STORAGE_BUCKET_NAME || 'testero-media';
export const CDN_URL = process.env.GCP_CDN_URL || 'https://media.testero.ai';

// Initialize GCP Storage client
let storage: Storage;

/**
 * Initialize the GCP Storage client
 * This function handles different authentication methods:
 * 1. Service account key file (for local development)
 * 2. Application Default Credentials (for production/GCP environments)
 */
export function initStorage(): Storage {
  if (storage) return storage;

  const keyFilePath = process.env.GCP_KEY_FILE_PATH;
  
  if (keyFilePath) {
    // Use service account key file if provided
    storage = new Storage({
      keyFilename: keyFilePath,
    });
  } else {
    // Use Application Default Credentials
    storage = new Storage();
  }
  
  return storage;
}

/**
 * Upload a file to GCP Cloud Storage
 * 
 * @param filePath - Local file path
 * @param destination - Destination path in the bucket
 * @param options - Upload options
 * @returns URL of the uploaded file
 */
export async function uploadFile(
  filePath: string,
  destination: string,
  options: {
    contentType?: string;
    cacheControl?: string;
    makePublic?: boolean; // Kept for backward compatibility but not used with uniform bucket-level access
    metadata?: Record<string, string>;
  } = {}
): Promise<string> {
  const {
    contentType,
    cacheControl = 'public, max-age=31536000', // 1 year default cache
    metadata = {},
  } = options;

  // Initialize storage if not already initialized
  const storageClient = initStorage();
  const bucket = storageClient.bucket(BUCKET_NAME);
  
  // Upload options
  const uploadOptions: UploadOptions = {
    destination,
    metadata: {
      cacheControl,
      metadata,
    } as {
      cacheControl?: string;
      contentType?: string;
      metadata?: Record<string, string>;
    },
  };
  
  // Ensure metadata is defined
  if (!uploadOptions.metadata) {
    uploadOptions.metadata = {};
  }
  
  // Add content type if provided
  if (contentType) {
    uploadOptions.metadata.contentType = contentType;
  }

  // Upload the file
  await bucket.upload(filePath, uploadOptions);
  
  // Return the CDN URL
  return `${CDN_URL}/${destination}`;
}

/**
 * Upload a buffer to GCP Cloud Storage
 * 
 * @param buffer - File buffer
 * @param destination - Destination path in the bucket
 * @param options - Upload options
 * @returns URL of the uploaded file
 */
export async function uploadBuffer(
  buffer: Buffer,
  destination: string,
  options: {
    contentType?: string;
    cacheControl?: string;
    makePublic?: boolean; // Kept for backward compatibility but not used with uniform bucket-level access
    metadata?: Record<string, string>;
  } = {}
): Promise<string> {
  const {
    contentType,
    cacheControl = 'public, max-age=31536000', // 1 year default cache
    metadata = {},
  } = options;

  // Initialize storage if not already initialized
  const storageClient = initStorage();
  const bucket = storageClient.bucket(BUCKET_NAME);
  const file = bucket.file(destination);
  
  // File options
  const fileOptions: SaveOptions = {
    resumable: false,
    metadata: {
      cacheControl,
      metadata,
    } as {
      cacheControl?: string;
      contentType?: string;
      metadata?: Record<string, string>;
    },
  };
  
  // Ensure metadata is defined
  if (!fileOptions.metadata) {
    fileOptions.metadata = {};
  }
  
  // Add content type if provided
  if (contentType) {
    fileOptions.metadata.contentType = contentType;
  }

  // Upload the buffer
  await file.save(buffer, fileOptions);
  
  // Return the CDN URL
  return `${CDN_URL}/${destination}`;
}

/**
 * Get a signed URL for a file in GCP Cloud Storage
 * 
 * @param filename - File path in the bucket
 * @param options - Signed URL options
 * @returns Signed URL
 */
export async function getSignedUrl(
  filename: string,
  options: {
    action?: 'read' | 'write' | 'delete' | 'resumable';
    expires?: number; // In seconds
    contentType?: string;
  } = {}
): Promise<string> {
  const {
    action = 'read',
    expires = 15 * 60, // 15 minutes default
    contentType,
  } = options;

  // Initialize storage if not already initialized
  const storageClient = initStorage();
  const bucket = storageClient.bucket(BUCKET_NAME);
  const file = bucket.file(filename);
  
  // Signed URL options
  const signedUrlOptions: GetSignedUrlConfig = {
    action,
    expires: Date.now() + expires * 1000,
  };
  
  // Add content type if provided
  if (contentType) {
    signedUrlOptions.contentType = contentType;
  }

  // Get the signed URL
  const [url] = await file.getSignedUrl(signedUrlOptions);
  
  return url;
}

/**
 * Get the CDN URL for a file
 * 
 * @param filename - File path in the bucket
 * @returns CDN URL
 */
export function getCdnUrl(filename: string): string {
  return `${CDN_URL}/${filename}`;
}

/**
 * Check if a file exists in GCP Cloud Storage
 * 
 * @param filename - File path in the bucket
 * @returns Whether the file exists
 */
export async function fileExists(filename: string): Promise<boolean> {
  // Initialize storage if not already initialized
  const storageClient = initStorage();
  const bucket = storageClient.bucket(BUCKET_NAME);
  const file = bucket.file(filename);
  
  // Check if the file exists
  const [exists] = await file.exists();
  
  return exists;
}

/**
 * Delete a file from GCP Cloud Storage
 * 
 * @param filename - File path in the bucket
 */
export async function deleteFile(filename: string): Promise<void> {
  // Initialize storage if not already initialized
  const storageClient = initStorage();
  const bucket = storageClient.bucket(BUCKET_NAME);
  const file = bucket.file(filename);
  
  // Delete the file
  await file.delete();
}

/**
 * Configure CORS for the bucket
 * 
 * @param origins - Allowed origins
 * @param methods - Allowed methods
 * @param maxAgeSeconds - Max age in seconds
 */
export async function configureBucketCors(
  origins: string[] = ['*'],
  methods: string[] = ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'],
  maxAgeSeconds: number = 3600
): Promise<void> {
  // Initialize storage if not already initialized
  const storageClient = initStorage();
  const bucket = storageClient.bucket(BUCKET_NAME);
  
  // Configure CORS
  await bucket.setCorsConfiguration([
    {
      origin: origins,
      method: methods,
      responseHeader: ['Content-Type', 'x-goog-meta-*'],
      maxAgeSeconds,
    },
  ]);
}
