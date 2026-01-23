const Analytics = require("../models/analytics");
const UAParser = require("ua-parser-js");
const Order = require("../models/order");
const {
    getStoreDashboardData,
    getProductStatsData,
} = require("../services/analyticsService");

/**
 * Registrar un evento de analytics
 * Evita duplicados recientes (últimos 30 minutos) para el mismo sessionId/evento
 */
const trackEvent = async (req, res) => {
    try {
        const { eventType, storeId, productId, sessionId } = req.body;

        // Validaciones básicas
        if (!eventType || !storeId) {
            return res.status(400).json({ msg: "eventType y storeId son requeridos" });
        }

        const validEvents = ["view_product", "view_store", "add_to_cart", "purchase"];
        if (!validEvents.includes(eventType)) {
            return res.status(400).json({ msg: "eventType inválido" });
        }

        // Para view_product se requiere productId
        if (eventType === "view_product" && !productId) {
            return res.status(400).json({ msg: "productId es requerido para view_product" });
        }

        // Obtener información del user agent
        const userAgentString = req.headers["user-agent"] || "";

        const parser = new UAParser(userAgentString);
        const uaResult = parser.getResult();

        // Construir metadata
        const metadata = {
            referrer: req.headers.referer || req.headers.referrer || "",
            device: uaResult.device.type || "desktop",
            browser: uaResult.browser.name || "unknown",
        };

        // Verificar si ya existe un evento reciente similar (últimos 30 minutos)
        // Esto evita logs duplicados por recargas de página
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

        const queryConditions = {
            eventType,
            storeId,
            sessionId,
            createdAt: { $gte: thirtyMinutesAgo },
        };

        // Si es view_product, también verificar por productId
        if (eventType === "view_product") {
            queryConditions.productId = productId;
        }

        const existingEvent = await Analytics.findOne(queryConditions);

        if (existingEvent) {
            // Ya existe un evento reciente, no duplicar
            return res.status(200).json({
                msg: "Evento ya registrado recientemente",
                duplicate: true,
                eventId: existingEvent._id
            });
        }

        // Crear nuevo evento de analytics
        const analyticsEvent = new Analytics({
            eventType,
            storeId,
            productId: productId || undefined,
            userId: req.user?.id || undefined, // Si hay usuario autenticado
            sessionId,
            userAgent: userAgentString,
            metadata,
        });

        await analyticsEvent.save();

        res.status(201).json({
            msg: "Evento registrado exitosamente",
            eventId: analyticsEvent._id
        });
    } catch (error) {
        console.error("Error al registrar evento de analytics:", error);
        res.status(500).json({ msg: "Error al registrar evento", error: error.message });
    }
};

/**
 * Devuelve el resumen de órdenes para una tienda, el dinero total obtenido, cantidad de órdenes,
 * productos más vendidos y datos de revenue diario
 * @param {*} storeId - ObjectId de la tienda
 * @param {*} dateFilter - Filtro de fecha para createdAt
 * @returns 
 */
const getStoreOrdersAnalytics = async (storeId, dateFilter) => {
    const { getStoreOrdersAnalyticsData } = require("../services/analyticsService");
    return getStoreOrdersAnalyticsData({ storeId, dateFilter, OrderModel: Order });
}


/**
 * Obtener estadísticas del dashboard para una tienda
 */
const getStoreDashboard = async (req, res) => {
    try {
        const { storeId } = req.params;
        const payload = await getStoreDashboardData({
            storeId,
            query: req.query,
            AnalyticsModel: Analytics,
            OrderModel: Order,
        });

        res.status(200).json(payload);
    } catch (error) {
        console.error("Error al obtener dashboard de analytics:", error);
        res.status(500).json({ msg: "Error al obtener estadísticas", error: error.message });
    }
};

/**
 * Obtener estadísticas de un producto específico
 */
const getProductStats = async (req, res) => {
    try {
        const { productId } = req.params;
        const payload = await getProductStatsData({
            productId,
            query: req.query,
            AnalyticsModel: Analytics,
        });

        res.status(200).json(payload);
    } catch (error) {
        console.error("Error al obtener stats del producto:", error);
        res.status(500).json({ msg: "Error al obtener estadísticas", error: error.message });
    }
};

module.exports = {
    trackEvent,
    getStoreDashboard,
    getProductStats,
};
