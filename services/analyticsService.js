const mongoose = require("mongoose");

/**
 * Funciones puras (testeables sin DB)
 */
const roundTo = (value, decimals = 2) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    const factor = 10 ** decimals;
    const signedEpsilon = (numeric === 0 ? 1 : Math.sign(numeric)) * Number.EPSILON;
    return Math.round((numeric + signedEpsilon) * factor) / factor;
};

const computeRatePercent = (numerator, denominator, decimals = 2) => {
    const num = Number(numerator);
    const den = Number(denominator);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return 0;
    return roundTo((num / den) * 100, decimals);
};

const buildDateFilterFromQuery = ({ startDate, endDate, period = "7d", now = new Date() } = {}) => {
    if (startDate && endDate) {
        return {
            dateFilter: {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate),
                },
            },
            period,
        };
    }

    const periods = {
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
        "90d": 90 * 24 * 60 * 60 * 1000,
        "year": 365 * 24 * 60 * 60 * 1000,
    };

    const msAgo = periods[period] || periods["7d"];
    const fromDate = new Date(now.getTime() - msAgo);

    return {
        dateFilter: { createdAt: { $gte: fromDate } },
        period,
    };
};

const normalizeOrdersByStatus = (rows = []) =>
    rows.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
    }, {});

/**
 * Funciones con DB (aggregations)
 */
const toObjectId = (value) => {
    if (!value) return value;
    if (value instanceof mongoose.Types.ObjectId) return value;
    if (typeof value === "string") return mongoose.Types.ObjectId.createFromHexString(value);
    return value;
};

const getStoreOrdersAnalyticsData = async ({
    storeId,
    dateFilter = {},
    OrderModel,
} = {}) => {
    if (!OrderModel) throw new Error("OrderModel requerido");
    const storeObjectId = toObjectId(storeId);
    const baseFilter = { storeId: storeObjectId, ...dateFilter };
    const revenueFilter = {
        storeId: storeObjectId,
        status: { $nin: ["canceled", "returned"] },
        ...dateFilter,
    };
    const [
        ordersCount,
        nonCanceledOrdersCount,
        ordersByStatus,
        totalRevenue,
        topSellingProducts,
        dailyRevenue,
    ] = await Promise.all([
        // orderdsCount
        OrderModel.countDocuments(baseFilter),
        // nonCanceledOrdersCount
        OrderModel.countDocuments(revenueFilter),
        // ordersByStatus
        OrderModel.aggregate([{ $match: baseFilter }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
        // totalRevenue and totalItemsSold
        OrderModel.aggregate([
            { $match: revenueFilter },
            { $unwind: "$items" },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
                    totalItems: { $sum: "$items.quantity" },
                },
            },
        ]),
        // topSellingProducts
        OrderModel.aggregate([
            { $match: revenueFilter },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.productId",
                    totalSold: { $sum: "$items.quantity" },
                    totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
                    orderCount: { $sum: 1 },
                },
            },
            { $sort: { totalSold: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "product",
                },
            },
            { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    productId: "$_id",
                    productName: "$product.title",
                    productImage: { $arrayElemAt: ["$product.images", 0] },
                    productPrice: "$product.price",
                    totalSold: 1,
                    totalRevenue: 1,
                    orderCount: 1,
                },
            },
        ]),
        // dailyRevenue
        OrderModel.aggregate([
            { $match: revenueFilter },
            { $unwind: "$items" },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
                    orders: { $addToSet: "$_id" },
                    itemsSold: { $sum: "$items.quantity" },
                },
            },
            {
                $project: {
                    _id: 1,
                    revenue: 1,
                    orders: { $size: "$orders" },
                    itemsSold: 1,
                },
            },
            { $sort: { _id: 1 } },
        ]),
    ]);

    const totalMoney = totalRevenue.length > 0 ? totalRevenue[0].total : 0;
    const totalItemsSold = totalRevenue.length > 0 ? totalRevenue[0].totalItems : 0;

    const averageOrderValue = nonCanceledOrdersCount > 0 ? totalMoney / nonCanceledOrdersCount : 0;

    return {
        ordersCount,
        nonCanceledOrdersCount,
        totalMoney,
        totalItemsSold,
        averageOrderValue: roundTo(averageOrderValue, 2),
        ordersByStatus: normalizeOrdersByStatus(ordersByStatus),
        topSellingProducts,
        dailyRevenue,
    };
};

const getStoreDashboardData = async ({
    storeId,
    query = {},
    AnalyticsModel,
    OrderModel,
    now = new Date(),
} = {}) => {
    if (!AnalyticsModel) throw new Error("AnalyticsModel requerido");
    if (!OrderModel) throw new Error("OrderModel requerido");

    const storeObjectId = toObjectId(storeId);
    const { dateFilter, period } = buildDateFilterFromQuery({
        startDate: query.startDate,
        endDate: query.endDate,
        period: query.period || "7d",
        now,
    });

    const [
        totalStoreViews,
        uniqueStoreVisitors,
        totalProductViews,
        uniqueProductVisitors,
        totalAddToCarts,
        totalPurchases,
    ] = await Promise.all([
        AnalyticsModel.countDocuments({ storeId: storeObjectId, eventType: "view_store", ...dateFilter }),
        AnalyticsModel.distinct("sessionId", { storeId: storeObjectId, eventType: "view_store", ...dateFilter }).then(
            (arr) => arr.length
        ),
        AnalyticsModel.countDocuments({ storeId: storeObjectId, eventType: "view_product", ...dateFilter }),
        AnalyticsModel.distinct("sessionId", { storeId: storeObjectId, eventType: "view_product", ...dateFilter }).then(
            (arr) => arr.length
        ),
        AnalyticsModel.countDocuments({ storeId: storeObjectId, eventType: "add_to_cart", ...dateFilter }),
        AnalyticsModel.countDocuments({ storeId: storeObjectId, eventType: "purchase", ...dateFilter }),
    ]);

    const topProducts = await AnalyticsModel.aggregate([
        {
            $match: {
                storeId: storeObjectId,
                eventType: "view_product",
                ...dateFilter,
            },
        },
        {
            $group: {
                _id: "$productId",
                views: { $sum: 1 },
                uniqueVisitors: { $addToSet: "$sessionId" },
            },
        },
        {
            $project: {
                _id: 1,
                views: 1,
                uniqueVisitors: { $size: "$uniqueVisitors" },
            },
        },
        { $sort: { views: -1 } },
        { $limit: 10 },
        {
            $lookup: {
                from: "products",
                localField: "_id",
                foreignField: "_id",
                as: "product",
            },
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                productId: "$_id",
                productName: "$product.title",
                productImage: { $arrayElemAt: ["$product.images", 0] },
                views: 1,
                uniqueVisitors: 1,
            },
        },
    ]);

    const dailyStats = await AnalyticsModel.aggregate([
        { $match: { storeId: storeObjectId, ...dateFilter } },
        {
            $group: {
                _id: {
                    date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    eventType: "$eventType",
                },
                count: { $sum: 1 },
            },
        },
        {
            $group: {
                _id: "$_id.date",
                events: {
                    $push: {
                        eventType: "$_id.eventType",
                        count: "$count",
                    },
                },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    const deviceStats = await AnalyticsModel.aggregate([
        { $match: { storeId: storeObjectId, ...dateFilter } },
        { $group: { _id: "$metadata.device", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);

    const browserStats = await AnalyticsModel.aggregate([
        { $match: { storeId: storeObjectId, ...dateFilter } },
        { $group: { _id: "$metadata.browser", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
    ]);

    const conversionRate = computeRatePercent(totalPurchases, uniqueStoreVisitors, 2);
    const addToCartRate = computeRatePercent(totalAddToCarts, uniqueProductVisitors, 2);

    return {
        summary: {
            storeViews: { total: totalStoreViews, unique: uniqueStoreVisitors },
            productViews: { total: totalProductViews, unique: uniqueProductVisitors },
            addToCarts: totalAddToCarts,
            purchases: totalPurchases,
            conversionRate,
            addToCartRate,
        },
        ordersData: await getStoreOrdersAnalyticsData({ storeId, dateFilter, OrderModel }),
        topProducts,
        dailyStats,
        deviceStats,
        browserStats,
        period,
    };
};

const getProductStatsData = async ({ productId, query = {}, AnalyticsModel, now = new Date() } = {}) => {
    if (!AnalyticsModel) throw new Error("AnalyticsModel requerido");

    const { period = "7d" } = query;
    const periods = {
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
        "90d": 90 * 24 * 60 * 60 * 1000,
    };

    const msAgo = periods[period] || periods["7d"];
    const dateFilter = { createdAt: { $gte: new Date(now.getTime() - msAgo) } };

    const [totalViews, uniqueVisitors, addToCarts, purchases] = await Promise.all([
        AnalyticsModel.countDocuments({ productId, eventType: "view_product", ...dateFilter }),
        AnalyticsModel.distinct("sessionId", { productId, eventType: "view_product", ...dateFilter }).then((arr) => arr.length),
        AnalyticsModel.countDocuments({ productId, eventType: "add_to_cart", ...dateFilter }),
        AnalyticsModel.countDocuments({ productId, eventType: "purchase", ...dateFilter }),
    ]);

    return {
        productId,
        views: { total: totalViews, unique: uniqueVisitors },
        addToCarts,
        purchases,
        conversionRate: computeRatePercent(purchases, uniqueVisitors, 2),
        period,
    };
};

module.exports = {
    roundTo,
    computeRatePercent,
    buildDateFilterFromQuery,
    normalizeOrdersByStatus,
    getStoreOrdersAnalyticsData,
    getStoreDashboardData,
    getProductStatsData,
};
