import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(root, "data", "shoes.js");
const code = fs.readFileSync(dataPath, "utf8");
const context = { window: {} };

vm.createContext(context);
vm.runInContext(code, context, { filename: dataPath });

const shoes = context.window.RUNNING_SHOES || [];
const errors = [];
const warnings = [];

function localPathFromUrl(url) {
  if (!url || /^https?:\/\//i.test(url)) return "";
  return path.join(root, url.split("?")[0]);
}

function dimensions(filePath) {
  try {
    const output = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", filePath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const width = Number(output.match(/pixelWidth:\s*(\d+)/)?.[1] || 0);
    const height = Number(output.match(/pixelHeight:\s*(\d+)/)?.[1] || 0);
    return { width, height };
  } catch {
    return null;
  }
}

const ids = new Set();
let localCount = 0;
let measuredCount = 0;
let customImageScaleCount = 0;

for (const shoe of shoes) {
  if (ids.has(shoe.id)) errors.push(`duplicate id: ${shoe.id}`);
  ids.add(shoe.id);

  if (!shoe.imageUrl) errors.push(`${shoe.id}: imageUrl is empty`);
  if (/lineup|dcinside|download\.php/i.test(shoe.imageUrl || "")) {
    errors.push(`${shoe.id}: table or forum image is used as shoe image`);
  }
  if (/shoes-cutout-safe/i.test(shoe.imageUrl || "")) {
    errors.push(`${shoe.id}: deprecated background-removed image is still used`);
  }
  if (!shoe.imageSourceUrl) errors.push(`${shoe.id}: imageSourceUrl is empty`);
  if (!shoe.officialProductUrl) errors.push(`${shoe.id}: officialProductUrl is empty`);
  if (!shoe.displayName) warnings.push(`${shoe.id}: displayName is empty`);
  if (!shoe.officialImageUrl) warnings.push(`${shoe.id}: officialImageUrl metadata is empty`);
  if (!shoe.imageFit) errors.push(`${shoe.id}: imageFit is empty`);
  if (!shoe.imagePosition) errors.push(`${shoe.id}: imagePosition is empty`);
  if (!Number.isFinite(Number(shoe.imageScale)) || Number(shoe.imageScale) <= 0) {
    errors.push(`${shoe.id}: imageScale is invalid`);
  }
  if (Number(shoe.imageScale) !== 1) customImageScaleCount += 1;
  if (!shoe.imageQuality) warnings.push(`${shoe.id}: imageQuality metadata is empty`);
  if (!shoe.imageFacing) warnings.push(`${shoe.id}: imageFacing metadata is empty`);

  const filePath = localPathFromUrl(shoe.imageUrl);
  if (!filePath) continue;

  localCount += 1;
  if (!fs.existsSync(filePath)) {
    errors.push(`${shoe.id}: local image missing: ${path.relative(root, filePath)}`);
    continue;
  }

  const stats = fs.statSync(filePath);
  if (stats.size < 12_000) warnings.push(`${shoe.id}: local image file is unusually small (${stats.size} bytes)`);

  const size = dimensions(filePath);
  if (!size) continue;
  measuredCount += 1;
  if (size.width < 600 || size.height < 400) {
    warnings.push(`${shoe.id}: low image resolution ${size.width}x${size.height}`);
  }
}

const referencedPaths = shoes.map((shoe) => localPathFromUrl(shoe.imageUrl)).filter(Boolean);
const referenced = new Set(referencedPaths.map((filePath) => path.resolve(filePath)));
const assetDirs = [...new Set(referencedPaths.map((filePath) => path.dirname(filePath)))];
const unused = assetDirs.flatMap((assetDir) =>
  fs
    .readdirSync(assetDir)
    .filter((file) => /\.(jpe?g|png|webp)$/i.test(file))
    .map((file) => path.join(assetDir, file))
    .filter((filePath) => !referenced.has(path.resolve(filePath)))
    .map((filePath) => path.relative(root, filePath))
);

if (unused.length) warnings.push(`${unused.length} local shoe assets are not referenced by data/shoes.js`);

console.log(`Shoes: ${shoes.length}`);
console.log(`Local images: ${localCount}`);
console.log(`Measured images: ${measuredCount}`);
console.log(`Custom image scale metadata: ${customImageScaleCount}`);
console.log(`Warnings: ${warnings.length}`);
warnings.slice(0, 30).forEach((warning) => console.log(`warning: ${warning}`));
if (warnings.length > 30) console.log(`warning: ...and ${warnings.length - 30} more`);

if (errors.length) {
  console.error(`Errors: ${errors.length}`);
  errors.forEach((error) => console.error(`error: ${error}`));
  process.exit(1);
}

console.log("Image audit passed");
