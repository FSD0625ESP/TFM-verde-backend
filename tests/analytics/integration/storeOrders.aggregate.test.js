const { connectInMemoryMongo, clearDatabase, disconnectInMemoryMongo } = require("../_helpers/mongoMemory");
const { seedFixedDataset } = require("../_helpers/fixedDataset");

const { getStoreOrdersAnalyticsData } = require("../../../services/analyticsService");

const Analytics = require("../../../models/analytics");
const Order = require("../../../models/order");
const Product = require("../../../models/product");

describe("analyticsService (integration) - getStoreOrdersAnalyticsData aggregations", () => {
    beforeAll(async () => {
        await connectInMemoryMongo();
    });

    beforeEach(async () => {
        await clearDatabase();
    });

    afterAll(async () => {
        await disconnectInMemoryMongo();
    });

    test("excluye canceladas del revenue y calcula dailyRevenue/topSellingProducts", async () => {
        const { ids, dateRange } = await seedFixedDataset({
            ProductModel: Product,
            AnalyticsModel: Analytics,
            OrderModel: Order,
        });

        const dateFilter = {
            createdAt: {
                $gte: new Date(dateRange.startDate),
                $lte: new Date(dateRange.endDate),
            },
        };

        const payload = await getStoreOrdersAnalyticsData({
            storeId: ids.storeId,
            dateFilter,
            OrderModel: Order,
        });

        expect(payload.ordersCount).toBe(3);
        expect(payload.nonCanceledOrdersCount).toBe(2);

        // delivered: 20+20=40, shipped: 10 => total 50
        expect(payload.totalMoney).toBe(50);
        expect(payload.totalItemsSold).toBe(2 + 1 + 1); // A:2 + A:1 + B:1
        expect(payload.averageOrderValue).toBe(25);

        // Top selling: Producto A (3 unidades) > Producto B (1 unidad)
        expect(payload.topSellingProducts[0].productId.toString()).toBe(ids.productAId.toString());
        expect(payload.topSellingProducts[0].totalSold).toBe(3);

        // dailyRevenue: día 1 => 40, día 2 => 10 (canceled ignora)
        const day1 = payload.dailyRevenue.find((d) => d._id === "2025-01-01");
        const day2 = payload.dailyRevenue.find((d) => d._id === "2025-01-02");

        expect(day1.revenue).toBe(40);
        expect(day2.revenue).toBe(10);

        // Invariante: revenue total = suma dailyRevenue
        const sumRevenue = payload.dailyRevenue.reduce((sum, d) => sum + d.revenue, 0);
        expect(sumRevenue).toBe(payload.totalMoney);
    });
});
