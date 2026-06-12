/**
 * Generate PWA icons from SVG logo
 * Run: node scripts/generate-icons.js
 * Requires: sharp (npm install sharp --save-dev)
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');
const LOGO_SVG = path.join(__dirname, '..', 'public', 'images', 'logo.svg');

// Ensure icons directory exists
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

async function generateIcons() {
  const svgBuffer = fs.readFileSync(LOGO_SVG);

  // Regular icons
  for (const size of [192, 512]) {
    await sharp(svgBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toFile(path.join(ICONS_DIR, `icon-${size}x${size}.png`));
    console.log(`✅ icon-${size}x${size}.png`);
  }

  // Maskable icon (with padding + background for safe zone)
  const maskableSize = 512;
  const padding = Math.round(maskableSize * 0.1); // 10% safe zone
  const innerSize = maskableSize - padding * 2;

  await sharp(svgBuffer)
    .resize(innerSize, innerSize, { fit: 'contain', background: { r: 30, g: 64, b: 175, alpha: 1 } })
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 30, g: 64, b: 175, alpha: 1 }, // theme_color #1e40af
    })
    .png()
    .toFile(path.join(ICONS_DIR, `icon-maskable-${maskableSize}x${maskableSize}.png`));
  console.log(`✅ icon-maskable-${maskableSize}x${maskableSize}.png`);

  // Apple touch icon (180x180)
  await sharp(svgBuffer)
    .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(path.join(ICONS_DIR, 'apple-touch-icon.png'));
  console.log('✅ apple-touch-icon.png');

  console.log('\n🎉 All PWA icons generated!');
}

generateIcons().catch(console.error);
