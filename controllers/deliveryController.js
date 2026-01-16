const Delivery = require("../models/delivery");
const Order = require("../models/order");
const Store = require("../models/store");

const canAccessDelivery = async ({ userId, delivery }) => {
    const order = await Order.findById(delivery.orderId).select("customerId storeId");
    if (!order) return false;

    if (order.customerId?.toString() === userId) return true;

    const store = await Store.findById(order.storeId).select("ownerId");
    if (store?.ownerId?.toString() === userId) return true;

    return false;
};

// GET /deliveries/order/:orderId
const getDeliveryByOrderId = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user.id;

        const delivery = await Delivery.findOne({ orderId });
        if (!delivery) return res.status(404).json({ msg: "Delivery no encontrado" });

        const allowed = await canAccessDelivery({ userId, delivery });
        if (!allowed) return res.status(403).json({ msg: "No tienes acceso a este delivery" });

        res.json(delivery);
    } catch (err) {
        res.status(500).json({ msg: "Error al obtener delivery" });
    }
};

module.exports = {
    getDeliveryByOrderId,
};
