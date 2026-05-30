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

for (const shoe of shoes) {
  if (ids.has(shoe.id)) errors.push(`duplicate id: ${shoe.id}`);
  ids.add(shoe.id);

  if (!shoe.imageUrl) errors.push(`${shoe.id}: imageUrl is empty`);
  if (/lineup|dcinside|download\.php/i.test(shoe.imageUrl || "")) {
    errors.push(`${shoe.id}: table or forum image is used as shoe image`);
  }
  if (!shoe.imageSourceUrl) errors.push(`${shoe.id}: imageSourceUrl is empty`);
  if (!shoe.officialProductUrl) errors.push(`${shoe.id}: officialProductUrl is empty`);
  if (!shoe.displayName) warnings.push(`${shoe.id}: displayName is empty`);
  if (!shoe.officialImageUrl) warnings.push(`${shoe.id}: officialImageUrl metadata is empty`);

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

const assetDir = path.join(root, "assets", "shoes");
const referenced = new Set(
  shoes
    .map((shoe) => localPathFromUrl(shoe.imageUrl))
    .filter(Boolean)
    .map((filePath) => path.basename(filePath).normalize("NFC"))
);
const unused = fs
  .readdirSync(assetDir)
  .filter((file) => /\.(jpe?g|png|webp)$/i.test(file))
  .filter((file) => !referenced.has(file.normalize("NFC")));

if (unused.length) warnings.push(`${unused.length} local shoe assets are not referenced by data/shoes.js`);

console.log(`Shoes: ${shoes.length}`);
console.log(`Local images: ${localCount}`);
console.log(`Measured images: ${measuredCount}`);
console.log(`Warnings: ${warnings.length}`);
warnings.slice(0, 30).forEach((warning) => console.log(`warning: ${warning}`));
if (warnings.length > 30) console.log(`warning: ...and ${warnings.length - 30} more`);

if (errors.length) {
  console.error(`Errors: ${errors.length}`);
  errors.forEach((error) => console.error(`error: ${error}`));
  process.exit(1);
}

console.log("Image audit passed");
