/**
 * Generate favicons from logo.svg
 * Creates all necessary favicon formats for Next.js App Router
 */

import sharp from "sharp";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const LOGO_SVG_PATH = join(process.cwd(), "logo.svg");
const APP_DIR = join(process.cwd(), "app");

// Ensure app directory exists
if (!existsSync(APP_DIR)) {
  mkdirSync(APP_DIR, { recursive: true });
}

async function generateFavicons() {
  console.log("🎨 Generating favicons from logo.svg...");

  if (!existsSync(LOGO_SVG_PATH)) {
    console.error(`❌ Logo SVG not found at ${LOGO_SVG_PATH}`);
    process.exit(1);
  }

  const svgBuffer = readFileSync(LOGO_SVG_PATH);

  try {
    // Generate icon.svg (scalable favicon for modern browsers)
    console.log("  → Generating icon.svg...");
    writeFileSync(join(APP_DIR, "icon.svg"), svgBuffer);

    // Generate icon.png (32x32 default)
    console.log("  → Generating icon.png (32x32)...");
    const icon32 = await sharp(svgBuffer)
      .resize(32, 32, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer();
    writeFileSync(join(APP_DIR, "icon.png"), icon32);

    // Generate apple-icon.png (180x180 for iOS)
    console.log("  → Generating apple-icon.png (180x180)...");
    const appleIcon = await sharp(svgBuffer)
      .resize(180, 180, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer();
    writeFileSync(join(APP_DIR, "apple-icon.png"), appleIcon);

    // Generate favicon.ico (multi-size: 16, 32, 48)
    // Note: sharp doesn't support ICO directly, so we'll create a 32x32 PNG
    // and Next.js will handle the ICO conversion, or we can use a simple approach
    console.log("  → Generating favicon.ico (32x32)...");
    const favicon32 = await sharp(svgBuffer)
      .resize(32, 32, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer();
    
    // For ICO, we'll create a simple 32x32 PNG and rename it
    // Next.js App Router expects favicon.ico in the app directory
    // We'll create it as PNG format which browsers will accept
    writeFileSync(join(APP_DIR, "favicon.ico"), favicon32);

    console.log("✅ Favicons generated successfully!");
    console.log(`   - ${join(APP_DIR, "icon.svg")}`);
    console.log(`   - ${join(APP_DIR, "icon.png")}`);
    console.log(`   - ${join(APP_DIR, "apple-icon.png")}`);
    console.log(`   - ${join(APP_DIR, "favicon.ico")}`);
  } catch (error) {
    console.error("❌ Error generating favicons:", error);
    process.exit(1);
  }
}

generateFavicons();
