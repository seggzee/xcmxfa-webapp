/**
 * PWA Icon Generator (Node CLI Script)
 *
 * HOW TO RUN:
 *   node scripts/generate-pwa-icons.mjs
 *
 * REQUIREMENTS:
 *   npm install sharp
 *
 * INPUT:
 *   assets/logos/xcmxfa-app-icon.webp
 *
 * OUTPUT:
 *   public/pwa-icons/
 *     - icon-192.png
 *     - icon-512.png
 *     - icon-maskable-512.png
 *     - apple-touch-icon.png
 *     - favicon-32.png
 *
 * NOTES:
 * - Runs in Node ONLY (not browser)
 * - Uses Sharp for high-quality resizing
 * - Standard icons use transparent background
 * - Apple touch icon uses solid white background (iOS-friendly)
 * - Maskable icon uses solid white background with padded safe area
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SRC = path.resolve("assets/logos/xcmxfa-app-icon.webp");
const OUT_DIR = path.resolve("public/pwa-icons");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  ensureDir(OUT_DIR);

  // ===============================
  // Standard PWA icons (transparent)
  // ===============================
  await sharp(SRC)
    .resize(192, 192, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: "lanczos3",
    })
    .png()
    .toFile(path.join(OUT_DIR, "icon-192.png"));

  await sharp(SRC)
    .resize(512, 512, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: "lanczos3",
    })
    .png()
    .toFile(path.join(OUT_DIR, "icon-512.png"));

  // ===============================
  // Maskable icon (white background + safe padding)
  // ===============================
  const inner = 410;

  const maskableBuffer = await sharp(SRC)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: "lanczos3",
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: maskableBuffer, gravity: "center" }])
    .png()
    .toFile(path.join(OUT_DIR, "icon-maskable-512.png"));

  // ===============================
  // Apple touch icon (white background)
  // ===============================
  await sharp(SRC)
    .resize(180, 180, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
      kernel: "lanczos3",
    })
    .png()
    .toFile(path.join(OUT_DIR, "apple-touch-icon.png"));

  // ===============================
  // Favicon PNG (32x32, transparent)
  // ===============================
  await sharp(SRC)
    .resize(32, 32, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: "lanczos3",
    })
    .png()
    .toFile(path.join(OUT_DIR, "favicon-32.png"));

  console.log("✅ PWA icons generated in public/pwa-icons/");
  console.log("Run from project root:");
  console.log("  node public/scripts/generate-pwa-icons.mjs");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});