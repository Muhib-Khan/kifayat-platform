require("dotenv").config();
const mongoose = require("mongoose");
const https = require("https");
const zlib = require("zlib");
const Settings = require("../models/Settings");
const Product = require("../models/Product");
const DynamicData = require("../models/DynamicData");

function hhcGet(url, token) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "X-Requested-With": "XMLHttpRequest",
    Authorization: `Bearer ${token}`,
    Referer: process.env.HHC_REFERER || "https://member.hhcdropshipping.com/",
    Origin: process.env.HHC_ORIGIN || "https://member.hhcdropshipping.com",
  };
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: url.hostname, port: 443, path: url.pathname + url.search, method: "GET", headers }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        const enc = res.headers["content-encoding"] || "";
        let raw = buf.toString("utf-8");
        if (enc.includes("gzip")) raw = zlib.gunzipSync(buf).toString("utf-8");
        else if (enc.includes("deflate")) raw = zlib.inflateSync(buf).toString("utf-8");
        else if (enc.includes("br")) { try { raw = zlib.brotliDecompressSync(buf).toString("utf-8"); } catch {} }
        resolve({ status: res.statusCode, body: raw });
      });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("timeout")); });
    req.end();
  });
}

function summarize(value, depth = 0) {
  if (value === undefined || value === null) return String(value);
  if (depth > 2) return "...";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `Array(${value.length}) [${summarize(value[0], depth + 1)}${value.length > 1 ? ", ..." : ""}]`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    return `{${keys.slice(0, 12).map((k) => `${k}: ${summarize(value[k], depth + 1)}`).join(", ")}${keys.length > 12 ? ", ..." : ""}}`;
  }
  return JSON.stringify(value).slice(0, 60);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const settings = await Settings.findOne({}).lean();
  const token = settings?.hhcToken || "";
  if (!token) { console.log("NO TOKEN"); process.exit(0); }

  const dynCount = await DynamicData.countDocuments({});
  console.log("DynamicData records in DB:", dynCount);
  if (dynCount > 0) {
    const sample = await DynamicData.findOne({}).lean();
    console.log("\nsample record slug:", sample.slug, "fetchedAt:", sample.fetchedAt);
    console.log("rawData summary:", summarize(sample.rawData));
  }

  const product = await Product.findOne({ slug: { $ne: "", $exists: true } }).lean();
  const r = await hhcGet(new URL(`https://member.hhcdropshipping.com/api/dropshipper/product/slug/${encodeURIComponent(product.slug)}`), token);
  console.log("\nfetch status:", r.status);
  if (r.status === 200) {
    const data = JSON.parse(r.body);
    console.log("top-level keys:", Object.keys(data).join(", "));
    for (const k of ["product_thumbnail", "product_galleries", "size_chart_image", "variations", "attributes", "recordings", "detail", "tags", "reviews"]) {
      console.log(`\n--- ${k} ---`);
      console.log(summarize(data[k]));
    }
    const out = { status: r.status, topKeys: Object.keys(data), variation: data.variation, recordings: data.product_recordings ?? data.recordings, detail: data.detail, thumbnail: data.product_thumbnail, inspections: data.product_inspections };
    require("fs").writeFileSync("scripts/debug_sample_response.json", JSON.stringify(out, null, 2));
    console.log("\nsample response saved to scripts/debug_sample_response.json");
  }
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
