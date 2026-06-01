import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();
const snapshotPath = path.join(ROOT, "data/prices/latest.js");
const context = { window: {} };

vm.createContext(context);
vm.runInContext(fs.readFileSync(snapshotPath, "utf8"), context, {
  filename: "data/prices/latest.js",
});

const snapshot = context.window.RUNNING_PRICE_SNAPSHOT;

if (!snapshot || typeof snapshot !== "object") {
  fail("RUNNING_PRICE_SNAPSHOT is missing.");
}

if (snapshot.currency !== "KRW") {
  fail("currency must be KRW.");
}

if (!snapshot.items || typeof snapshot.items !== "object" || Array.isArray(snapshot.items)) {
  fail("items must be an object.");
}

Object.entries(snapshot.items).forEach(([shoeId, item]) => {
  if (!["found", "no_match", "error"].includes(item.status)) {
    fail(`${shoeId}: invalid status ${item.status}`);
  }
  if (typeof item.query !== "string") {
    fail(`${shoeId}: query must be a string.`);
  }
  if (!Array.isArray(item.offers)) {
    fail(`${shoeId}: offers must be an array.`);
  }
  if (item.status === "found") {
    if (!Number.isFinite(item.lowestPrice) || item.lowestPrice <= 0) {
      fail(`${shoeId}: lowestPrice must be a positive number.`);
    }
    if (item.lowestPrice < 45000) {
      fail(`${shoeId}: lowestPrice is suspiciously low.`);
    }
    if (!item.lowestOffer || item.lowestOffer.price !== item.lowestPrice) {
      fail(`${shoeId}: lowestOffer must match lowestPrice.`);
    }
  }
  item.offers.forEach((offer, index) => {
    if (!Number.isFinite(offer.price) || offer.price <= 0) {
      fail(`${shoeId}: offer ${index} has an invalid price.`);
    }
    if (!offer.title || !offer.link) {
      fail(`${shoeId}: offer ${index} needs title and link.`);
    }
  });
});

console.log(`Price snapshot OK: ${Object.keys(snapshot.items).length} shoes`);

function fail(message) {
  console.error(message);
  process.exit(1);
}
