const crypto = require("crypto");
const CompensationVoucher = require("../models/CompensationVoucher");
const Product = require("../models/Product");

const VOUCHER_TYPES = ["discount_all", "discount_specific", "free_product"];
const DISCOUNT_VALUES = [1, 2];
const MIN_VOUCHERS = 1;
const MAX_VOUCHERS = 3;
const EXPIRY_DAYS = 30;

function randomInt(min, max) {
  return crypto.randomInt(min, max + 1);
}

function pickRandom(arr) {
  return arr[crypto.randomInt(arr.length)];
}

async function pickRandomProduct() {
  const count = await Product.countDocuments({ stock: { $gt: 0 } });
  if (count === 0) return null;
  const skip = crypto.randomInt(count);
  const product = await Product.findOne({ stock: { $gt: 0 } }).skip(skip).lean();
  return product || null;
}

async function generateCompensationVouchers({ user, cancelOrder, adminSpec = null }) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  let vouchersToCreate = [];

  if (adminSpec && Array.isArray(adminSpec.vouchers) && adminSpec.vouchers.length > 0) {
    for (const spec of adminSpec.vouchers) {
      if (!VOUCHER_TYPES.includes(spec.voucher_type)) continue;
      const voucher = {
        user: user,
        cancelOrder: cancelOrder,
        voucher_type: spec.voucher_type,
        discount_percent: spec.discount_percent || null,
        products: spec.products || [],
        generated_at: now,
        used: false,
        used_at: null,
        expires_at: expiresAt,
        used_on_order: null,
      };
      vouchersToCreate.push(voucher);
    }
  } else {
    const count = randomInt(MIN_VOUCHERS, MAX_VOUCHERS);

    for (let i = 0; i < count; i++) {
      const type = pickRandom(VOUCHER_TYPES);
      const voucher = {
        user: user,
        cancelOrder: cancelOrder,
        voucher_type: type,
        generated_at: now,
        used: false,
        used_at: null,
        expires_at: expiresAt,
        used_on_order: null,
      };

      if (type === "discount_all") {
        voucher.discount_percent = pickRandom(DISCOUNT_VALUES);
        voucher.products = [];
      } else if (type === "discount_specific") {
        voucher.discount_percent = pickRandom(DISCOUNT_VALUES);
        const randProduct = await pickRandomProduct();
        voucher.products = randProduct ? [randProduct._id] : [];
      } else if (type === "free_product") {
        voucher.discount_percent = 100;
        const randProduct = await pickRandomProduct();
        voucher.products = randProduct ? [randProduct._id] : [];
      }

      if (type !== "discount_all" && voucher.products.length === 0) {
        voucher.voucher_type = "discount_all";
        voucher.discount_percent = pickRandom(DISCOUNT_VALUES);
        voucher.products = [];
      }

      vouchersToCreate.push(voucher);
    }
  }

  if (vouchersToCreate.length === 0) return [];

  const created = await CompensationVoucher.insertMany(vouchersToCreate);

  console.log(
    `[Compensation] Generated ${created.length} voucher(s) for user ${user} ` +
      `(cancel order: ${cancelOrder})`
  );

  return created;
}

async function getCompensationStats() {
  const stats = await CompensationVoucher.aggregate([
    {
      $group: {
        _id: null,
        totalGenerated: { $sum: 1 },
        totalUsed: { $sum: { $cond: ["$used", 1, 0] } },
        totalUnused: { $sum: { $cond: ["$used", 0, 1] } },
        totalExpired: {
          $sum: {
            $cond: [
              { $and: [{ $lt: ["$expires_at", new Date()] }, { $eq: ["$used", false] }] },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const typeBreakdown = await CompensationVoucher.aggregate([
    {
      $group: {
        _id: "$voucher_type",
        count: { $sum: 1 },
        used: { $sum: { $cond: ["$used", 1, 0] } },
      },
    },
  ]);

  const byMonth = await CompensationVoucher.aggregate([
    {
      $group: {
        _id: {
          year: { $year: "$generated_at" },
          month: { $month: "$generated_at" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": -1, "_id.month": -1 } },
    { $limit: 12 },
  ]);

  return {
    totals: stats[0] || { totalGenerated: 0, totalUsed: 0, totalUnused: 0, totalExpired: 0 },
    byType: typeBreakdown,
    byMonth,
  };
}

module.exports = {
  generateCompensationVouchers,
  getCompensationStats,
};
