const mongoose = require("mongoose");

const { connectInMemoryMongo, clearDatabase, disconnectInMemoryMongo } = require("../_helpers/mongoMemory");
const { seedFixedDataset } = require("../_helpers/fixedDataset");

const { getStoreDashboardData } = require("../../../services/analyticsService");

const Analytics = require("../../../models/analytics");
const Order = require("../../../models/order");
const Product = require("../../../models/product");

describe("analyticsService (integration) - getStoreDashboardData aggregations", () => {
    beforeAll(async () => {
        await connectInMemoryMongo();
    });

    beforeEach(async () => {
        await clearDatabase();
    });

    afterAll(async () => {
        await disconnectInMemoryMongo();
    });

    test("calcula summary, topProducts y dailyStats de forma consistente", async () => {
        const { ids, dateRange } = await seedFixedDataset({
            ProductModel: Product,
            AnalyticsModel: Analytics,
            OrderModel: Order,
        });

        const payload = await getStoreDashboardData({
            storeId: ids.storeId,
            query: {
                startDate: dateRange.startDate,
                endDate: dateRange.endDate,
            },
            AnalyticsModel: Analytics,
            OrderModel: Order,
        });

        expect(payload.summary.storeViews.total).toBe(3);
        expect(payload.summary.storeViews.unique).toBe(2);

        expect(payload.summary.productViews.total).toBe(4);
        expect(payload.summary.productViews.unique).toBe(2);

        expect(payload.summary.addToCarts).toBe(2);
        expect(payload.summary.purchases).toBe(1);

        expect(payload.summary.conversionRate).toBe(50);
        expect(payload.summary.addToCartRate).toBe(100);

        expect(payload.topProducts.length).toBeGreaterThan(0);
        expect(payload.topProducts[0].productId.toString()).toBe(ids.productAId.toString());
        expect(payload.topProducts[0].views).toBe(3);

        // Invariante: suma de dailyStats == total eventos filtrados
        const sumDaily = payload.dailyStats
            .flatMap((d) => d.events)
            .reduce((sum, e) => sum + e.count, 0);

        const totalEvents = await Analytics.countDocuments({
            storeId: ids.storeId,
            createdAt: {
                $gte: new Date(dateRange.startDate),
                $lte: new Date(dateRange.endDate),
            },
        });

        expect(sumDaily).toBe(totalEvents);

        // Invariantes básicos
        expect(payload.summary.conversionRate).toBeGreaterThanOrEqual(0);
        expect(payload.summary.addToCartRate).toBeGreaterThanOrEqual(0);
    });
});
