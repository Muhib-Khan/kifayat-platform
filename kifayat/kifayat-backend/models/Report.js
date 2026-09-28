const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    periodNumber: { type: Number, required: true, unique: true },
    startDate:    { type: Date, required: true },
    endDate:      { type: Date, required: true },
    generatedAt:  { type: Date, default: Date.now },
    topProduct: {
      name:        String,
      sku:         String,
      category:    String,
      periodSales: Number,
      totalSales:  Number,
      retailPrice: Number,
    },
    products: [
      {
        rank:        Number,
        name:        String,
        sku:         String,
        category:    String,
        retailPrice: Number,
        periodSales: Number, // sales in this period = salesCount - snapshot
        totalSales:  Number, // cumulative salesCount
      },
    ],
    totalPeriodSales: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "reports" }
);

module.exports = mongoose.model("Report", reportSchema);
