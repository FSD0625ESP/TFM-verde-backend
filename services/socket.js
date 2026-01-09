const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

// Mapa para rastrear usuarios conectados (soporta múltiples pestañas/sockets por usuario)
// userId -> Set<socketId>
const connectedUsers = new Map();

const addConnectedSocket = (userId, socketId) => {
    if (!connectedUsers.has(userId)) {
        connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId).add(socketId);
};

const removeConnectedSocket = (userId, socketId) => {
    const socketIds = connectedUsers.get(userId);
    if (!socketIds) return;
    socketIds.delete(socketId);
    if (socketIds.size === 0) {
        connectedUsers.delete(userId);
    }
};

const getUserSocketIds = (userId) => {
    const socketIds = connectedUsers.get(userId);
    if (!socketIds) return [];
    return Array.from(socketIds);
};

const emitToUser = (io, userId, event, payload) => {
    const socketIds = getUserSocketIds(userId);
    socketIds.forEach((socketId) => io.to(socketId).emit(event, payload));
};

const canAccessOrder = async ({ userId, orderId }) => {
    const Order = require("../models/order");
    const Store = require("../models/store");

    if (!orderId) return false;

    const order = await Order.findById(orderId).select("customerId storeId");
    if (!order) return false;

    if (order.customerId?.toString() === userId) return true;

    const store = await Store.findById(order.storeId).select("ownerId");
    if (store?.ownerId?.toString() === userId) return true;

    return false;
};

const getUserChatIds = async (userId) => {
    const Chat = require("../models/chat");

    // Ideal: query por ownerId/userId (sin resolver Store). Fallback legacy: si hay chats sin ownerId,
    // el join se completará cuando el cliente abra el dropdown (join_chats) o tras backfill.
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const chats = await Chat.find({
        $or: [
            { userId: userObjectId },
            { ownerId: userObjectId },
        ],
        deletedAt: null,
    }).select("_id");

    return chats.map((c) => c._id.toString());
};

const computeUnreadTotalForUser = async (userId) => {
    const Chat = require("../models/chat");

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const customerAgg = await Chat.aggregate([
        { $match: { userId: userObjectId, deletedAt: null } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$customerUnreadCount", 0] } } } },
    ]);

    const ownerAgg = await Chat.aggregate([
        { $match: { ownerId: userObjectId, deletedAt: null } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$ownerUnreadCount", 0] } } } },
    ]);

    return (customerAgg?.[0]?.total || 0) + (ownerAgg?.[0]?.total || 0);
};

const emitUnreadCountToUser = async (io, userId) => {
    try {
        const total = await computeUnreadTotalForUser(userId);
        emitToUser(io, userId, "unread_messages_count", total);
    } catch (_) {
        // noop
    }
};

/**
 * Configura Socket.IO con autenticación y event handlers
 * @param {Server} io - Instancia de Socket.IO
 */
const setupSocketIO = (io) => {
    // Middleware para autenticar sockets
    io.use((socket, next) => {
        // Leer el token desde las cookies HTTP (enviadas automáticamente con withCredentials)
        const cookies = socket.handshake.headers.cookie;

        if (!cookies) {
            return next(new Error("Error de autenticación: no se proporcionaron cookies"));
        }

        // Parsear las cookies para obtener el token
        const tokenCookie = cookies.split('; ').find(row => row.startsWith('token='));

        if (!tokenCookie) {
            return next(new Error("Error de autenticación: no hay token en las cookies"));
        }

        const token = tokenCookie.split('=')[1];

        if (!token) {
            return next(new Error("Error de autenticación: token vacío"));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.id;
            socket.userEmail = decoded.email;
            next();
        } catch (error) {
            next(new Error("Error de autenticación: token inválido"));
        }
    });

    io.on("connection", (socket) => {

        // Registrar usuario conectado (multi-tab)
        addConnectedSocket(socket.userId, socket.id);
        // Notificar presencia
        if (connectedUsers.get(socket.userId)?.size === 1) {
            io.emit("user_online", { userId: socket.userId });
        }

        const joinMyChats = async () => {
            const chatIds = await getUserChatIds(socket.userId);
            chatIds.forEach((chatId) => socket.join(`chat:${chatId}`));
            await emitUnreadCountToUser(io, socket.userId);
        };

        // Auto-join al conectar para recibir mensajes aunque el dropdown/chat no se abra
        joinMyChats().catch(() => { /* noop */ });

        // Permite reintentar/forzar join desde el cliente
        socket.on("join_my_chats", async () => {
            await joinMyChats();
        });

        // Usuario se une a sus salas de chat
        socket.on("join_chats", (chatIds) => {
            chatIds.forEach((chatId) => {
                socket.join(`chat:${chatId}`);
            });
            emitUnreadCountToUser(io, socket.userId);
        });

        // Consulta de presencia por IDs
        socket.on("presence_check", ({ userIds }) => {
            const status = {};
            (userIds || []).forEach((id) => {
                status[id] = connectedUsers.has(id);
            });
            socket.emit("presence_status", status);
        });

        // Enviar mensaje
        socket.on("send_message", async (data) => {
            await handleSendMessage(socket, io, data);
        });

        // =========================
        // Delivery tracking (simulado)
        // =========================
        socket.on("join_delivery", async ({ deliveryId }) => {
            try {
                if (!deliveryId) return;
                const Delivery = require("../models/delivery");
                const Order = require("../models/order");
                const Store = require("../models/store");

                const delivery = await Delivery.findById(deliveryId);
                if (!delivery) return;

                const order = await Order.findById(delivery.orderId).select("customerId storeId");
                if (!order) return;

                const isCustomer = order.customerId?.toString() === socket.userId;
                const store = await Store.findById(order.storeId).select("ownerId");
                const isOwner = store?.ownerId?.toString() === socket.userId;

                if (!isCustomer && !isOwner) return;

                const room = `delivery:${deliveryId}`;
                socket.join(room);

                const route = Array.isArray(delivery.route) ? delivery.route : [];
                const idx = Math.max(0, Math.min(delivery.currentIndex || 0, Math.max(route.length - 1, 0)));
                const currentLocation = route[idx] || delivery.origin;

                socket.emit("delivery_update", {
                    deliveryId: delivery._id.toString(),
                    orderId: delivery.orderId?.toString?.() || delivery.orderId,
                    status: delivery.status,
                    origin: delivery.origin,
                    destination: delivery.destination,
                    route,
                    currentIndex: idx,
                    currentLocation,
                    startedAt: delivery.startedAt,
                    eta: delivery.eta,
                });
            } catch (_) {
                // noop
            }
        });

        // =========================
        // Order tracking (simulado)
        // =========================
        socket.on("join_order", async ({ orderId }) => {
            try {
                if (!orderId) return;
                const allowed = await canAccessOrder({ userId: socket.userId, orderId });
                if (!allowed) return;

                socket.join(`order:${orderId}`);

                const Order = require("../models/order");
                const order = await Order.findById(orderId).select("_id status");
                if (!order) return;

                socket.emit("order_update", {
                    orderId: order._id.toString(),
                    status: order.status,
                });
            } catch (_) {
                // noop
            }
        });

        socket.on("start_order_shipping", async ({ orderId }) => {
            try {
                if (!orderId) return;
                const allowed = await canAccessOrder({ userId: socket.userId, orderId });
                if (!allowed) return;

                const Order = require("../models/order");
                const Delivery = require("../models/delivery");
                const { startDeliverySimulation } = require("./deliverySimulation");

                const order = await Order.findById(orderId).select("_id status");
                if (!order) return;

                // Pasar a shipped si procede
                if (order.status === "pending") {
                    order.status = "shipped";
                    await order.save();
                }

                io.to(`order:${order._id.toString()}`).emit("order_update", {
                    orderId: order._id.toString(),
                    status: order.status,
                });

                // Arrancar el delivery asociado
                const delivery = await Delivery.findOne({ orderId: order._id });
                if (!delivery) return;

                // Arrancar simulación (si ya estaba on_route, esto es idempotente)
                startDeliverySimulation({ io, deliveryId: delivery._id.toString(), orderId: order._id.toString() }).catch(() => { /* noop */ });
            } catch (_) {
                // noop
            }
        });

        // Usuario está escribiendo
        socket.on("typing", (data) => {
            const { chatId } = data;
            socket.to(`chat:${chatId}`).emit("user_typing", {
                chatId,
                userId: socket.userId,
                userEmail: socket.userEmail,
            });
        });

        // Usuario dejó de escribir
        socket.on("stop_typing", (data) => {
            const { chatId } = data;
            socket.to(`chat:${chatId}`).emit("user_stop_typing", {
                chatId,
                userId: socket.userId,
            });
        });

        // Marcar mensajes como leídos
        socket.on("mark_as_read", async ({ chatId }) => {
            try {
                const Chat = require("../models/chat");
                const Store = require("../models/store");
                const chat = await Chat.findById(chatId);
                if (!chat) return;
                const store = await Store.findById(chat.storeId);
                const now = new Date();
                if (chat.userId.toString() === socket.userId) {
                    chat.customerLastReadAt = now;
                    chat.customerUnreadCount = 0;
                } else if (store?.ownerId?.toString() === socket.userId) {
                    chat.ownerLastReadAt = now;
                    chat.ownerUnreadCount = 0;
                    if (!chat.ownerId) {
                        chat.ownerId = store.ownerId;
                    }
                }
                await chat.save();
                socket.to(`chat:${chatId}`).emit("messages_read", {
                    chatId,
                    userId: socket.userId,
                    at: now,
                });

                await emitUnreadCountToUser(io, socket.userId);
            } catch (_) {
                // noop
            }
        });

        // Desconexión
        socket.on("disconnect", () => {
            removeConnectedSocket(socket.userId, socket.id);
            if (!connectedUsers.has(socket.userId)) {
                io.emit("user_offline", { userId: socket.userId });
            }
        });
    });
};

/**
 * Maneja el envío de mensajes a través de Socket.IO
 * @param {Socket} socket - Socket del usuario
 * @param {Server} io - Instancia de Socket.IO
 * @param {Object} data - Datos del mensaje {chatId, text}
 */
const handleSendMessage = async (socket, io, data) => {
    const { chatId, text } = data;

    try {
        const Chat = require("../models/chat");
        const chat = await Chat.findById(chatId);

        if (!chat) {
            return socket.emit("error", { message: "Chat no encontrado" });
        }

        // Verificar permisos
        const Store = require("../models/store");
        const store = await Store.findById(chat.storeId);
        const isOwner = store.ownerId.toString() === socket.userId;
        const isCustomer = chat.userId.toString() === socket.userId;

        if (!isOwner && !isCustomer) {
            return socket.emit("error", { message: "No tienes acceso a este chat" });
        }

        // Obtener información del remitente antes de guardar
        const User = require("../models/user");
        const sender = await User.findById(socket.userId).select('firstName lastName avatar');

        if (!sender) {
            return socket.emit("error", { message: "Usuario no encontrado" });
        }

        // Asegurar ownerId desnormalizado para futuras consultas rápidas
        if (!chat.ownerId && store?.ownerId) {
            chat.ownerId = store.ownerId;
        }

        // Marcar como leído para el remitente (al enviar, por definición está al día)
        const now = new Date();
        if (isCustomer) {
            chat.customerLastReadAt = now;
            chat.customerUnreadCount = 0;
        } else if (isOwner) {
            chat.ownerLastReadAt = now;
            chat.ownerUnreadCount = 0;
        }

        // Añadir mensaje con ObjectId
        const newMessage = {
            senderId: new mongoose.Types.ObjectId(socket.userId),
            text: text.trim(),
            timestamp: now,
        };

        chat.messages.push(newMessage);

        // Mantener lastMessage desnormalizado
        chat.lastMessage = {
            senderId: newMessage.senderId,
            text: newMessage.text,
            timestamp: newMessage.timestamp,
        };

        // Incrementar no leídos del receptor (O(1))
        if (isCustomer) {
            chat.ownerUnreadCount = Number(chat.ownerUnreadCount || 0) + 1;
        } else if (isOwner) {
            chat.customerUnreadCount = Number(chat.customerUnreadCount || 0) + 1;
        }

        await chat.save();

        // Obtener el mensaje recién guardado con su _id
        const savedMessage = chat.messages[chat.messages.length - 1];

        const messageWithSender = {
            _id: savedMessage._id,
            text: savedMessage.text,
            timestamp: savedMessage.timestamp,
            senderId: {
                _id: socket.userId,
                firstName: sender.firstName,
                lastName: sender.lastName,
                avatar: sender.avatar,
            },
        };

        // Emitir a todos en la sala del chat
        io.to(`chat:${chatId}`).emit("new_message", {
            chatId,
            message: messageWithSender,
        });

        // Actualizar contador total de no leídos para ambos participantes
        const customerId = chat.userId?.toString();
        const ownerId = store?.ownerId?.toString();
        if (customerId) await emitUnreadCountToUser(io, customerId);
        if (ownerId) await emitUnreadCountToUser(io, ownerId);
    } catch (error) {
        socket.emit("error", { message: "Error al enviar mensaje" });
    }
};

/**
 * Obtiene el socket ID de un usuario conectado
 * @param {string} userId - ID del usuario
 * @returns {string|undefined} Socket ID del usuario
 */
const getUserSocketId = (userId) => {
    const socketIds = getUserSocketIds(userId);
    return socketIds[0];
};

/**
 * Verifica si un usuario está conectado
 * @param {string} userId - ID del usuario
 * @returns {boolean}
 */
const isUserConnected = (userId) => {
    return connectedUsers.has(userId);
};

module.exports = {
    setupSocketIO,
    getUserSocketId,
    isUserConnected,
    connectedUsers,
};
