import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SRC = path.resolve("assets/logos/xcmxfa-app-icon.webp");
const OUT_DIR = path.resolve("public/icons");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  ensureDir(OUT_DIR);

  // Standard icons (tight fit is ok but do NOT crop)
  await sharp(SRC)
    .resize(192, 192, { fit: "contain", background: { r: 10, g: 31, b: 68, alpha: 1 } })
    .png()
    .toFile(path.join(OUT_DIR, "icon-192.png"));

  await sharp(SRC)
    .resize(512, 512, { fit: "contain", background: { r: 10, g: 31, b: 68, alpha: 1 } })
    .png()
    .toFile(path.join(OUT_DIR, "icon-512.png"));

  // Maskable: add more padding by fitting the artwork into a smaller box
  // (e.g. 80% of 512 => 410, then center it on 512 canvas)
  const inner = 410;

  const buffer = await sharp(SRC)
    .resize(inner, inner, { fit: "contain" })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 10, g: 31, b: 68, alpha: 1 }
    }
  })
    .composite([{ input: buffer, gravity: "center" }])
    .png()
    .toFile(path.join(OUT_DIR, "icon-maskable-512.png"));

  console.log("✅ PWA icons generated in public/icons/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
