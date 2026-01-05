const mongoose = require("mongoose");

const fixedIds = {
    storeId: new mongoose.Types.ObjectId("64b000000000000000000001"),
    productAId: new mongoose.Types.ObjectId("64b000000000000000000002"),
    productBId: new mongoose.Types.ObjectId("64b000000000000000000003"),
    categoryId: new mongoose.Types.ObjectId("64b000000000000000000004"),
    customerId: new mongoose.Types.ObjectId("64b000000000000000000005"),
    addressId: new mongoose.Types.ObjectId("64b000000000000000000006"),
};

const buildFixedDataset = () => {
    const day1 = new Date("2025-01-01T10:00:00.000Z");
    const day1Later = new Date("2025-01-01T12:00:00.000Z");
    const day2 = new Date("2025-01-02T10:00:00.000Z");

    const products = [
        {
            _id: fixedIds.productAId,
            storeId: fixedIds.storeId,
            title: "Producto A",
            slug: "producto-a",
            description: "Desc A",
            longDescription: "Long Desc A",
            price: 10,
            images: ["https://example.com/a.jpg"],
            stock: 100,
            categories: [fixedIds.categoryId],
            createdAt: day1,
            updatedAt: day1,
        },
        {
            _id: fixedIds.productBId,
            storeId: fixedIds.storeId,
            title: "Producto B",
            slug: "producto-b",
            description: "Desc B",
            longDescription: "Long Desc B",
            price: 20,
            images: ["https://example.com/b.jpg"],
            stock: 100,
            categories: [fixedIds.categoryId],
            createdAt: day1,
            updatedAt: day1,
        },
    ];

    const analyticsEvents = [
        // Store views (2 sesiones, 3 eventos)
        {
            eventType: "view_store",
            storeId: fixedIds.storeId,
            sessionId: "s1",
            metadata: { device: "desktop", browser: "Chrome", referrer: "" },
            createdAt: day1,
            updatedAt: day1,
        },
        {
            eventType: "view_store",
            storeId: fixedIds.storeId,
            sessionId: "s2",
            metadata: { device: "mobile", browser: "Safari", referrer: "" },
            createdAt: day1Later,
            updatedAt: day1Later,
        },
        {
            eventType: "view_store",
            storeId: fixedIds.storeId,
            sessionId: "s1",
            metadata: { device: "desktop", browser: "Chrome", referrer: "" },
            createdAt: day2,
            updatedAt: day2,
        },

        // Product views: A (3 vistas, 2 sesiones), B (1 vista)
        {
            eventType: "view_product",
            storeId: fixedIds.storeId,
            productId: fixedIds.productAId,
            sessionId: "s1",
            metadata: { device: "desktop", browser: "Chrome", referrer: "" },
            createdAt: day1,
            updatedAt: day1,
        },
        {
            eventType: "view_product",
            storeId: fixedIds.storeId,
            productId: fixedIds.productAId,
            sessionId: "s1",
            metadata: { device: "desktop", browser: "Chrome", referrer: "" },
            createdAt: day1Later,
            updatedAt: day1Later,
        },
        {
            eventType: "view_product",
            storeId: fixedIds.storeId,
            productId: fixedIds.productAId,
            sessionId: "s2",
            metadata: { device: "mobile", browser: "Safari", referrer: "" },
            createdAt: day2,
            updatedAt: day2,
        },
        {
            eventType: "view_product",
            storeId: fixedIds.storeId,
            productId: fixedIds.productBId,
            sessionId: "s2",
            metadata: { device: "mobile", browser: "Safari", referrer: "" },
            createdAt: day2,
            updatedAt: day2,
        },

        // Add to cart (2)
        {
            eventType: "add_to_cart",
            storeId: fixedIds.storeId,
            productId: fixedIds.productAId,
            sessionId: "s1",
            metadata: { device: "desktop", browser: "Chrome", referrer: "" },
            createdAt: day2,
            updatedAt: day2,
        },
        {
            eventType: "add_to_cart",
            storeId: fixedIds.storeId,
            productId: fixedIds.productBId,
            sessionId: "s2",
            metadata: { device: "mobile", browser: "Safari", referrer: "" },
            createdAt: day2,
            updatedAt: day2,
        },

        // Purchase (1)
        {
            eventType: "purchase",
            storeId: fixedIds.storeId,
            productId: fixedIds.productAId,
            sessionId: "s1",
            metadata: { device: "desktop", browser: "Chrome", referrer: "" },
            createdAt: day2,
            updatedAt: day2,
        },
    ];

    const orders = [
        // No canceladas: 2
        {
            customerId: fixedIds.customerId,
            storeId: fixedIds.storeId,
            addressId: fixedIds.addressId,
            status: "delivered",
            items: [
                { productId: fixedIds.productAId, quantity: 2, price: 10 }, // 20
                { productId: fixedIds.productBId, quantity: 1, price: 20 }, // 20
            ],
            createdAt: day1,
            updatedAt: day1,
        },
        {
            customerId: fixedIds.customerId,
            storeId: fixedIds.storeId,
            addressId: fixedIds.addressId,
            status: "shipped",
            items: [{ productId: fixedIds.productAId, quantity: 1, price: 10 }], // 10
            createdAt: day2,
            updatedAt: day2,
        },

        // Cancelada: debe excluirse de revenue
        {
            customerId: fixedIds.customerId,
            storeId: fixedIds.storeId,
            addressId: fixedIds.addressId,
            status: "canceled",
            items: [{ productId: fixedIds.productBId, quantity: 5, price: 20 }], // 100 (IGNORAR)
            createdAt: day2,
            updatedAt: day2,
        },
    ];

    return {
        ids: fixedIds,
        products,
        analyticsEvents,
        orders,
        dateRange: {
            startDate: "2025-01-01T00:00:00.000Z",
            endDate: "2025-01-03T00:00:00.000Z",
        },
    };
};

const seedFixedDataset = async ({ ProductModel, AnalyticsModel, OrderModel }) => {
    const data = buildFixedDataset();
    await ProductModel.insertMany(data.products);
    await AnalyticsModel.insertMany(data.analyticsEvents);
    await OrderModel.insertMany(data.orders);
    return data;
};

module.exports = {
    fixedIds,
    buildFixedDataset,
    seedFixedDataset,
};
