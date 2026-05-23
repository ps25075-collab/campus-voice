import sharp from "sharp";
import { readFileSync } from "fs";
import { resolve } from "path";

const svg = readFileSync(resolve("public/icon.svg"));

const tasks = [
  { out: "public/icon-192.png", size: 192 },
  { out: "public/icon-512.png", size: 512 },
  { out: "public/icon-maskable.png", size: 512, padding: 64 },
  { out: "public/apple-touch-icon.png", size: 180 },
];

for (const t of tasks) {
  const innerSize = t.padding ? t.size - t.padding * 2 : t.size;
  const inner = await sharp(svg).resize(innerSize, innerSize).png().toBuffer();
  await sharp({
    create: {
      width: t.size,
      height: t.size,
      channels: 4,
      background: t.padding ? { r: 26, g: 107, b: 60, alpha: 1 } : { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: inner, gravity: "center" }])
    .png()
    .toFile(t.out);
  console.log("✓", t.out);
}
