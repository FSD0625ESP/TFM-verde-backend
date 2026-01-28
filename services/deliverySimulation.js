const Delivery = require("../models/delivery");
const Order = require("../models/order");

// deliveryId -> { intervalId, noListenerCount }
const simulations = new Map();

// Máximo de ticks sin oyentes antes de pausar simulación
const MAX_NO_LISTENER_TICKS = 5;

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
    const room = `delivery:${deliveryId}`;
    
    // Verificar si hay clientes conectados en la sala antes de emitir
    const roomSockets = io.sockets.adapter.rooms.get(room);
    const clientCount = roomSockets ? roomSockets.size : 0;
    
    if (clientCount > 0) {
        io.to(room).emit("delivery_update", buildPayload(delivery));
        console.log(`🚚 Delivery update emitido para ${deliveryId} (${clientCount} cliente(s) escuchando)`);
    } else {
        console.log(`⏸️ Delivery ${deliveryId}: Sin clientes conectados, evento omitido`);
    }
};

const startDeliverySimulation = async ({ io, deliveryId, orderId, tickMs = 2000 }) => {
    if (!io) throw new Error("io requerido");
    if (!deliveryId) throw new Error("deliveryId requerido");

    const id = deliveryId.toString();

    if (simulations.has(id)) {
        console.log(`⚠️ Simulación ya activa para delivery ${id}`);
        return;
    }
    
    console.log(`🚀 Iniciando simulación de delivery ${id}`);
    let noListenerCount = 0;

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
            // Verificar si hay clientes escuchando antes de procesar
            const room = `delivery:${id}`;
            const roomSockets = io.sockets.adapter.rooms.get(room);
            const hasListeners = roomSockets && roomSockets.size > 0;
            
            // Si no hay nadie escuchando, incrementar contador
            if (!hasListeners) {
                noListenerCount++;
                console.log(`⏸️ Delivery ${id}: Sin oyentes (${noListenerCount}/${MAX_NO_LISTENER_TICKS})`);
                
                // Si nadie ha escuchado durante mucho tiempo, pausar simulación
                if (noListenerCount >= MAX_NO_LISTENER_TICKS) {
                    console.log(`⏸️ Pausando simulación delivery ${id} por inactividad`);
                    clearInterval(intervalId);
                    simulations.delete(id);
                    return;
                }
            } else {
                // Resetear contador si hay oyentes
                if (noListenerCount > 0) {
                    console.log(`▶️ Delivery ${id}: Oyentes reconectados, reseteando contador`);
                }
                noListenerCount = 0;
            }
            
            const delivery = await Delivery.findById(id);
            if (!delivery) {
                console.log(`❌ Delivery ${id} no encontrado, deteniendo simulación`);
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

            // Solo emitir si hay clientes conectados
            emitToRoom(io, id, delivery);

            if (delivery.status === "delivered") {
                console.log(`✅ Delivery ${id} completado`);
                
                // Sincronizar estado de la orden (simulado)
                if (orderId) {
                    try {
                        const updatedOrder = await Order.findByIdAndUpdate(
                            orderId,
                            { status: "delivered" },
                            { new: true }
                        ).select("_id status");
                        if (updatedOrder) {
                            const orderRoom = `order:${updatedOrder._id.toString()}`;
                            const orderRoomSockets = io.sockets.adapter.rooms.get(orderRoom);
                            
                            if (orderRoomSockets && orderRoomSockets.size > 0) {
                                io.to(orderRoom).emit("order_update", {
                                    orderId: updatedOrder._id.toString(),
                                    status: updatedOrder.status,
                                });
                                console.log(`📦 Order update emitido para ${updatedOrder._id} (${orderRoomSockets.size} cliente(s))`);
                            }
                        }
                    } catch (_) {
                        // noop
                    }
                }

                clearInterval(intervalId);
                simulations.delete(id);
            }
        } catch (error) {
            console.error(`❌ Error en simulación delivery ${id}:`, error.message);
            // Si hay errores persistentes, eventualmente detenemos la simulación
        }
    }, tickMs);

    simulations.set(id, { intervalId, noListenerCount: 0 });
};

const stopDeliverySimulation = (deliveryId) => {
    const id = deliveryId.toString();
    const simulation = simulations.get(id);
    if (simulation) {
        clearInterval(simulation.intervalId);
        simulations.delete(id);
        console.log(`🛑 Simulación delivery ${id} detenida manualmente`);
    }
};

const getActiveSimulations = () => {
    return Array.from(simulations.keys());
};

module.exports = {
    startDeliverySimulation,
    stopDeliverySimulation,
    getActiveSimulations,
};
