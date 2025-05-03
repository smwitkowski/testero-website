// This script generates optimized images for social sharing
// Run with: node scripts/generate-social-images.js

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PUBLIC_DIR = path.join(__dirname, '../public');

async function generateSocialImages() {
  try {
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
    .jpeg()
    .toFile(path.join(PUBLIC_DIR, 'og-image.jpg'));
    
    console.log('Generated og-image.jpg');

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
    .jpeg()
    .toFile(path.join(PUBLIC_DIR, 'twitter-image.jpg'));
    
    console.log('Generated twitter-image.jpg');

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
    .toFile(path.join(PUBLIC_DIR, 'logo.png'));
    
    console.log('Generated logo.png');

    console.log('All social images generated successfully!');
  } catch (error) {
    console.error('Error generating social images:', error);
  }
}

generateSocialImages();
