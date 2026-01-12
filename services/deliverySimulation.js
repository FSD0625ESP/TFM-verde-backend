const Delivery = require("../models/delivery");
const Order = require("../models/order");

// deliveryId -> intervalId
const simulations = new Map();

const buildPayload = (delivery) => {
    const route = Array.isArray(delivery.route) ? delivery.route : [];
    const idx = Math.max(0, Math.min(delivery.currentIndex || 0, Math.max(route.length - 1, 0)));
    const currentLocation = route[idx] || delivery.origin;

    return {
        deliveryId: delivery._id.toString(),
        orderId: delivery.orderId?.toString?.() || delivery.orderId,
        status: delivery.status,
        origin: delivery.origin,
        destination: delivery.destination,
        currentIndex: idx,
        currentLocation,
        route,
        startedAt: delivery.startedAt,
        eta: delivery.eta,
    };
};

const emitToRoom = (io, deliveryId, delivery) => {
    io.to(`delivery:${deliveryId}`).emit("delivery_update", buildPayload(delivery));
};

const startDeliverySimulation = async ({ io, deliveryId, orderId, tickMs = 2000 }) => {
    if (!io) throw new Error("io requerido");
    if (!deliveryId) throw new Error("deliveryId requerido");

    const id = deliveryId.toString();

    if (simulations.has(id)) {
        return;
    }

    // Asegurar que el delivery tiene startedAt/eta cuando realmente empieza la simulación
    try {
        const initial = await Delivery.findById(id);
        if (initial && initial.status !== "delivered") {
            if (!initial.startedAt) {
                initial.startedAt = new Date();
            }
            const routeLen = Array.isArray(initial.route) ? initial.route.length : 0;
            const remaining = Math.max(routeLen - 1 - (initial.currentIndex || 0), 0);
            if (!initial.eta) {
                initial.eta = new Date(initial.startedAt.getTime() + remaining * tickMs);
            }
            if (initial.status === "pending") {
                initial.status = "on_route";
            }
            await initial.save();
            emitToRoom(io, id, initial);
        }
    } catch (_) {
        // noop
    }

    const intervalId = setInterval(async () => {
        try {
            const delivery = await Delivery.findById(id);
            if (!delivery) {
                clearInterval(intervalId);
                simulations.delete(id);
                return;
            }

            const routeLen = Array.isArray(delivery.route) ? delivery.route.length : 0;
            const lastIndex = Math.max(routeLen - 1, 0);
            const nextIndex = Math.min((delivery.currentIndex || 0) + 1, lastIndex);

            delivery.status = nextIndex >= lastIndex ? "delivered" : "on_route";
            delivery.currentIndex = nextIndex;
            await delivery.save();

            emitToRoom(io, id, delivery);

            if (delivery.status === "delivered") {
                // Sincronizar estado de la orden (simulado)
                if (orderId) {
                    try {
                        const updatedOrder = await Order.findByIdAndUpdate(
                            orderId,
                            { status: "delivered" },
                            { new: true }
                        ).select("_id status");
                        if (updatedOrder) {
                            io.to(`order:${updatedOrder._id.toString()}`).emit("order_update", {
                                orderId: updatedOrder._id.toString(),
                                status: updatedOrder.status,
                            });
                        }
                    } catch (_) {
                        // noop
                    }
                }

                clearInterval(intervalId);
                simulations.delete(id);
            }
        } catch (_) {
            // noop: si hay un fallo puntual, seguimos intentando
        }
    }, tickMs);

    simulations.set(id, intervalId);
};

const stopDeliverySimulation = (deliveryId) => {
    const id = deliveryId.toString();
    const intervalId = simulations.get(id);
    if (intervalId) {
        clearInterval(intervalId);
        simulations.delete(id);
    }
};

module.exports = {
    startDeliverySimulation,
    stopDeliverySimulation,
};
