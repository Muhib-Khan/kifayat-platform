const User = require("../models/User");
const ShippingDetail = require("../models/ShippingDetail");
const Order = require("../models/Order");
const PreOrder = require("../models/PreOrder");
const UserFinalData = require("../models/UserFinalData");
const { escapeRegex } = require("../utils/safeRegex");

const generateUserFinalData = async (req, res) => {
  try {
    const users = await User.find({ isVerified: true }).lean();

    const results = [];

    for (const user of users) {
      const shipping = await ShippingDetail.findOne({ user: user._id })
        .sort({ createdAt: -1 })
        .lean();

      const orders = await Order.find({ user: user._id }).lean();
      const preOrders = await PreOrder.find({ user: user._id }).lean();

      const totalOrders = orders.length + preOrders.length;
      const totalProductsBought = [...orders, ...preOrders].reduce(
        (sum, o) => sum + (o.items || []).reduce((s, i) => s + (i.quantity || 0), 0),
        0
      );
      const totalSpent = [...orders, ...preOrders].reduce(
        (sum, o) => sum + (o.totalAmount || 0),
        0
      );
      const lastOrderDate = [...orders, ...preOrders]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map((o) => o.createdAt)[0];

      const data = {
        user: user._id,
        name: user.name || "",
        email: user.email || "",
        gender: user.gender || "",
        authProvider: user.authProvider || "",
        isVerified: user.isVerified || false,
        role: user.role || "user",
        joinedAt: user.createdAt,
        lastActiveAt: user.lastActiveAt,
        orderConEmail: user.orderConEmail || "",
        shippingName: shipping?.name || "",
        shippingAddress: shipping?.address || "",
        shippingPhone: shipping?.phoneNumber || "",
        shippingPhone2: shipping?.phoneNumber2 || "",
        shippingEmail: shipping?.email || "",
        courierCity: shipping?.courierCity || "",
        courierCompany: shipping?.courierCompany || "",
        totalOrders,
        totalProductsBought,
        totalSpent,
        lastOrderDate,
      };

      const updated = await UserFinalData.findOneAndUpdate(
        { user: user._id },
        { $set: data },
        { upsert: true, new: true }
      ).lean();

      results.push(updated);
    }

    return res.status(200).json({
      success: true,
      message: `Generated data for ${results.length} users.`,
      count: results.length,
    });
  } catch (err) {
    console.error("generateUserFinalData error:", err);
    return res.status(500).json({ success: false, message: "Failed to generate user final data." });
  }
};

const getUserFinalData = async (req, res) => {
  try {
    const { q = "", page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (q.trim()) {
      const search = q.trim();
      filter.$or = [
        { name: { $regex: escapeRegex(search), $options: "i" } },
        { email: { $regex: escapeRegex(search), $options: "i" } },
        { shippingPhone: { $regex: escapeRegex(search), $options: "i" } },
      ];
    }

    const [data, total] = await Promise.all([
      UserFinalData.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      UserFinalData.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    console.error("getUserFinalData error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch user final data." });
  }
};

module.exports = { generateUserFinalData, getUserFinalData };
