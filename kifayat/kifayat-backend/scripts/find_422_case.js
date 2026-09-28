// Look for slugs that could trip HHC validation (non [a-z0-9-] chars) and
// check what status HHC returns for them — hunt for a reproducible 422.
require("dotenv").config();
const mongoose = require("mongoose");

const Product = require("../models/Product");
const { proxyRequest, resolveHhcToken } = require("../controllers/hhcApiController");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const token = await resolveHhcToken(undefined);
  console.log("token present:", Boolean(token));

  const weird = await Product.find({ slug: { $regex: /[^a-z0-9-]/ } })
    .limit(15)
    .lean();
  console.log("weird-slug products:", weird.length);

  let found422 = false;
  for (const p of weird) {
    const r = await proxyRequest(
      "/dropshipper/product/slug/" + encodeURIComponent(p.slug),
      token,
      null,
      1
    );
    console.log(r.status, "|", p.slug.slice(0, 90));
    if (r.status === 422) {
      found422 = true;
      console.log("422 body:", (typeof r.data === "string" ? r.data : JSON.stringify(r.data)).slice(0, 400));
      break;
    }
  }
  console.log("found 422:", found422);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
