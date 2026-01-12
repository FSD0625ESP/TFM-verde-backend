const mongoose = require("mongoose");
require("dotenv").config();

const Analytics = require("../models/analytics");
const Order = require("../models/order");
const Product = require("../models/product");

const { seedFixedDataset } = require("../tests/analytics/_helpers/fixedDataset");
const { getStoreDashboardData, getStoreOrdersAnalyticsData } = require("../services/analyticsService");

const run = async () => {
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) {
        throw new Error("Falta MONGO_URI en .env");
    }

    await mongoose.connect(MONGO_URI);

    try {
        // Mantenerlo acotado: solo colecciones relevantes para analytics
        await Promise.all([
            Analytics.deleteMany({}),
            Order.deleteMany({}),
            Product.deleteMany({}),
        ]);

        const { ids, dateRange } = await seedFixedDataset({
            ProductModel: Product,
            AnalyticsModel: Analytics,
            OrderModel: Order,
        });

        const dashboard = await getStoreDashboardData({
            storeId: ids.storeId,
            query: { startDate: dateRange.startDate, endDate: dateRange.endDate },
            AnalyticsModel: Analytics,
            OrderModel: Order,
        });

        const orders = await getStoreOrdersAnalyticsData({
            storeId: ids.storeId,
            dateFilter: {
                createdAt: {
                    $gte: new Date(dateRange.startDate),
                    $lte: new Date(dateRange.endDate),
                },
            },
            OrderModel: Order,
        });

        // Invariantes rápidas (no exhaustivas)
        if (dashboard.summary.storeViews.total !== 3) throw new Error("verify: storeViews.total no cuadra");
        if (dashboard.summary.conversionRate !== 50) throw new Error("verify: conversionRate no cuadra");
        if (orders.totalMoney !== 50) throw new Error("verify: totalMoney no cuadra");

        console.log("✅ analytics verify OK");
        console.log("- dashboard.summary:", dashboard.summary);
        console.log("- orders.totalMoney:", orders.totalMoney);

        process.exit(0);
    } finally {
        await mongoose.disconnect();
    }
};

run().catch((err) => {
    console.error("❌ analytics verify FAILED:", err);
    process.exit(1);
});
