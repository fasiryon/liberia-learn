// scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "public", "icons");

mkdirSync(outDir, { recursive: true });

// Base SVG 512x512: dark green bg, white rounded rect, white bold "L"
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="64" fill="#1B4332"/>
  <rect x="96" y="96" width="320" height="320" rx="48" fill="white" opacity="0.15"/>
  <text x="256" y="340" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="bold" font-size="280" fill="white">L</text>
</svg>`;

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function main() {
  const svgBuffer = Buffer.from(svg);

  for (const size of sizes) {
    const outPath = join(outDir, `icon-${size}.png`);
    await sharp(svgBuffer).resize(size, size).png().toFile(outPath);
    console.log(`Created: public/icons/icon-${size}.png`);
  }

  // Favicon 32x32
  const faviconPath = join(root, "public", "favicon.ico");
  await sharp(svgBuffer).resize(32, 32).png().toFile(faviconPath);
  console.log("Created: public/favicon.ico");

  console.log("Done! All icons generated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
