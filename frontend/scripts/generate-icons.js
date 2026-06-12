/**
 * Generate PWA icons from public/icons/moli-csca-app-icon.png
 * Run: node scripts/generate-icons.js
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');
const APP_ICON = path.join(ICONS_DIR, 'moli-csca-app-icon.png');

if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

async function makeIcon(file, size, padding) {
  const innerSize = size - padding * 2;
  const image = await sharp(APP_ICON)
    .resize(innerSize, innerSize, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: image, gravity: 'center' }])
    .png()
    .toFile(path.join(ICONS_DIR, file));

  console.log(`Generated ${file}`);
}

async function generateIcons() {
  await makeIcon('icon-192x192.png', 192, 10);
  await makeIcon('icon-512x512.png', 512, 28);
  await makeIcon('icon-maskable-512x512.png', 512, 64);
  await makeIcon('apple-touch-icon.png', 180, 8);
  await makeIcon('favicon-32x32.png', 32, 1);
  await makeIcon('favicon-16x16.png', 16, 0);

  console.log('\nAll PWA icons generated.');
}

generateIcons().catch((error) => {
  console.error(error);
  process.exit(1);
});
