// This script generates optimized images for social sharing and uploads them to GCP Cloud Storage
// Run with: node scripts/generate-social-images.js

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { Storage } = require('@google-cloud/storage');
const os = require('os');

const PUBLIC_DIR = path.join(__dirname, '../public');
const TEMP_DIR = path.join(os.tmpdir(), 'testero-images');

// GCP Storage configuration
const BUCKET_NAME = process.env.GCP_STORAGE_BUCKET_NAME || 'testero-media';
const CDN_URL = process.env.GCP_CDN_URL || 'https://media.testero.ai';
const USE_GCP = process.env.USE_GCP_STORAGE === 'true';
const PROJECT_ID = process.env.GCP_PROJECT_ID;

// Debug environment variables
console.log('Environment Variables:');
console.log('- USE_GCP_STORAGE:', USE_GCP);
console.log('- GCP_STORAGE_BUCKET_NAME:', BUCKET_NAME);
console.log('- GCP_CDN_URL:', CDN_URL);
console.log('- GCP_PROJECT_ID:', PROJECT_ID);

// Create temp directory if it doesn't exist
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Initialize GCP Storage client if needed
let storage;
if (USE_GCP) {
  const keyFilePath = process.env.GCP_KEY_FILE_PATH;
  
  if (keyFilePath) {
    storage = new Storage({
      keyFilename: keyFilePath,
    });
  } else {
    storage = new Storage();
  }
}

/**
 * Upload a file to GCP Cloud Storage
 * 
 * @param {string} filePath - Local file path
 * @param {string} destination - Destination path in the bucket
 * @param {object} options - Upload options
 * @returns {string} URL of the uploaded file
 */
async function uploadToGCP(filePath, destination, options = {}) {
  if (!USE_GCP) {
    return `/${path.basename(filePath)}`;
  }

  const {
    contentType,
    cacheControl = 'public, max-age=31536000', // 1 year default cache
  } = options;

  const bucket = storage.bucket(BUCKET_NAME);
  
  // Upload options
  const uploadOptions = {
    destination,
    metadata: {
      cacheControl,
    },
  };
  
  // Add content type if provided
  if (contentType) {
    uploadOptions.metadata.contentType = contentType;
  }

  // Upload the file
  await bucket.upload(filePath, uploadOptions);
  
  // Return the CDN URL
  return `${CDN_URL}/${destination}`;
}

async function generateSocialImages() {
  try {
    // File paths
    const ogImagePath = USE_GCP 
      ? path.join(TEMP_DIR, 'og-image.jpg')
      : path.join(PUBLIC_DIR, 'og-image.jpg');
    
    const twitterImagePath = USE_GCP
      ? path.join(TEMP_DIR, 'twitter-image.jpg')
      : path.join(PUBLIC_DIR, 'twitter-image.jpg');
    
    const logoPath = USE_GCP
      ? path.join(TEMP_DIR, 'logo.png')
      : path.join(PUBLIC_DIR, 'logo.png');
    
    // Generate Open Graph image (1200x630)
    await sharp({
      create: {
        width: 1200,
        height: 630,
        channels: 4,
        background: { r: 30, g: 41, b: 59, alpha: 1 } // Slate-800 color
      }
    })
    .composite([
      {
        input: Buffer.from(`
          <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="50" width="1100" height="530" fill="none" stroke="#f97316" stroke-width="4" rx="20" />
            <text x="600" y="200" font-family="Arial" font-size="80" font-weight="bold" fill="white" text-anchor="middle">Testero</text>
            <text x="600" y="300" font-family="Arial" font-size="40" fill="white" text-anchor="middle">AI-Powered Certification Exam Preparation</text>
            <text x="600" y="400" font-family="Arial" font-size="30" fill="#f97316" text-anchor="middle">Ace your cloud certification exams confidently</text>
            <text x="600" y="500" font-family="Arial" font-size="24" fill="#94a3b8" text-anchor="middle">Join 1,200+ cloud professionals on the waitlist</text>
          </svg>
        `),
        gravity: 'center'
      }
    ])
    .jpeg({ quality: 90 })
    .toFile(ogImagePath);
    
    console.log('Generated og-image.jpg');

    // Generate WebP version of Open Graph image
    if (USE_GCP) {
      const ogImageWebPPath = path.join(TEMP_DIR, 'og-image.webp');
      await sharp(ogImagePath)
        .webp({ quality: 85 })
        .toFile(ogImageWebPPath);
      
      console.log('Generated og-image.webp');
    }

    // Generate Twitter image (same dimensions but optimized for Twitter)
    await sharp({
      create: {
        width: 1200,
        height: 630,
        channels: 4,
        background: { r: 30, g: 41, b: 59, alpha: 1 } // Slate-800 color
      }
    })
    .composite([
      {
        input: Buffer.from(`
          <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="50" width="1100" height="530" fill="none" stroke="#f97316" stroke-width="4" rx="20" />
            <text x="600" y="200" font-family="Arial" font-size="80" font-weight="bold" fill="white" text-anchor="middle">Testero</text>
            <text x="600" y="300" font-family="Arial" font-size="40" fill="white" text-anchor="middle">AI-Powered Certification Exam Preparation</text>
            <text x="600" y="400" font-family="Arial" font-size="30" fill="#f97316" text-anchor="middle">Ace your cloud certification exams confidently</text>
            <text x="600" y="500" font-family="Arial" font-size="24" fill="#94a3b8" text-anchor="middle">Join 1,200+ cloud professionals on the waitlist</text>
          </svg>
        `),
        gravity: 'center'
      }
    ])
    .jpeg({ quality: 90 })
    .toFile(twitterImagePath);
    
    console.log('Generated twitter-image.jpg');

    // Generate WebP version of Twitter image
    if (USE_GCP) {
      const twitterImageWebPPath = path.join(TEMP_DIR, 'twitter-image.webp');
      await sharp(twitterImagePath)
        .webp({ quality: 85 })
        .toFile(twitterImageWebPPath);
      
      console.log('Generated twitter-image.webp');
    }

    // Generate logo placeholder (512x512)
    await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: { r: 255, g: 140, b: 0, alpha: 1 }
      }
    })
    .composite([
      {
        input: Buffer.from(`
          <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
            <text x="256" y="256" font-family="Arial" font-size="120" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">T</text>
          </svg>
        `),
        gravity: 'center'
      }
    ])
    .png()
    .toFile(logoPath);
    
    console.log('Generated logo.png');

    // Generate WebP version of logo
    if (USE_GCP) {
      const logoWebPPath = path.join(TEMP_DIR, 'logo.webp');
      await sharp(logoPath)
        .webp({ quality: 90 })
        .toFile(logoWebPPath);
      
      console.log('Generated logo.webp');
    }

    // Upload to GCP if enabled
    if (USE_GCP) {
      // Upload JPEG/PNG versions
      const ogImageUrl = await uploadToGCP(ogImagePath, 'images/og-image.jpg', { contentType: 'image/jpeg' });
      const twitterImageUrl = await uploadToGCP(twitterImagePath, 'images/twitter-image.jpg', { contentType: 'image/jpeg' });
      const logoUrl = await uploadToGCP(logoPath, 'images/logo.png', { contentType: 'image/png' });
      
      console.log('Uploaded JPEG/PNG images to GCP Cloud Storage');
      console.log(`OG Image URL: ${ogImageUrl}`);
      console.log(`Twitter Image URL: ${twitterImageUrl}`);
      console.log(`Logo URL: ${logoUrl}`);
      
      // Upload WebP versions
      const ogImageWebPUrl = await uploadToGCP(
        path.join(TEMP_DIR, 'og-image.webp'), 
        'images/og-image.webp', 
        { contentType: 'image/webp' }
      );
      
      const twitterImageWebPUrl = await uploadToGCP(
        path.join(TEMP_DIR, 'twitter-image.webp'), 
        'images/twitter-image.webp', 
        { contentType: 'image/webp' }
      );
      
      const logoWebPUrl = await uploadToGCP(
        path.join(TEMP_DIR, 'logo.webp'), 
        'images/logo.webp', 
        { contentType: 'image/webp' }
      );
      
      console.log('Uploaded WebP images to GCP Cloud Storage');
      console.log(`OG Image WebP URL: ${ogImageWebPUrl}`);
      console.log(`Twitter Image WebP URL: ${twitterImageWebPUrl}`);
      console.log(`Logo WebP URL: ${logoWebPUrl}`);
      
      // Create a JSON file with image URLs for reference
      const imageUrls = {
        ogImage: {
          jpg: ogImageUrl,
          webp: ogImageWebPUrl
        },
        twitterImage: {
          jpg: twitterImageUrl,
          webp: twitterImageWebPUrl
        },
        logo: {
          png: logoUrl,
          webp: logoWebPUrl
        }
      };
      
      fs.writeFileSync(
        path.join(PUBLIC_DIR, 'image-urls.json'), 
        JSON.stringify(imageUrls, null, 2)
      );
      
      console.log('Created image-urls.json with CDN URLs');
    }

    console.log('All social images generated successfully!');
  } catch (error) {
    console.error('Error generating social images:', error);
    throw error; // Re-throw to ensure the build fails if images can't be generated
  }
}

generateSocialImages();
