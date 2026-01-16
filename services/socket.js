const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

let ioInstance = null;

/**
 * productId => {
 *   authUsers: Map<userId, Set<socketId>>,
 *   anonSockets: Set<socketId>
 * }
 */
const productViewers = new Map();

/**
 * userId -> Set<socketId>
 */
const connectedUsers = new Map();

const addConnectedSocket = (userId, socketId) => {
  if (!connectedUsers.has(userId)) {
    connectedUsers.set(userId, new Set());
  }
  connectedUsers.get(userId).add(socketId);
};

const removeConnectedSocket = (userId, socketId) => {
  const sockets = connectedUsers.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    connectedUsers.delete(userId);
  }
};

const getUserSocketId = (userId) => connectedUsers.get(userId) || new Set();

const emitToUser = (io, userId, event, payload) => {
  getUserSocketId(userId).forEach((sid) => io.to(sid).emit(event, payload));
};

const getUserChatIds = async (userId) => {
  const Chat = require("../models/chat");
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const chats = await Chat.find({
    $or: [{ userId: userObjectId }, { ownerId: userObjectId }],
    deletedAt: null,
  }).select("_id");

  return chats.map((c) => c._id.toString());
};

const computeUnreadTotalForUser = async (userId) => {
  const Chat = require("../models/chat");
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const [customerAgg, ownerAgg] = await Promise.all([
    Chat.aggregate([
      { $match: { userId: userObjectId, deletedAt: null } },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ["$customerUnreadCount", 0] } },
        },
      },
    ]),
    Chat.aggregate([
      { $match: { ownerId: userObjectId, deletedAt: null } },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ["$ownerUnreadCount", 0] } },
        },
      },
    ]),
  ]);

  return (customerAgg[0]?.total || 0) + (ownerAgg[0]?.total || 0);
};

const emitUnreadCountToUser = async (io, userId) => {
  try {
    const total = await computeUnreadTotalForUser(userId);
    emitToUser(io, userId, "unread_messages_count", total);
  } catch { }
};

const setupSocketIO = (io) => {
  ioInstance = io;

  /**
   * Middleware permisivo:
   * - Soporta sockets anónimos
   * - Autenticación solo si hay token válido
   */
  io.use((socket, next) => {
    const cookies = socket.handshake.headers.cookie;
    let token = null;

    if (cookies) {
      const row = cookies.split("; ").find((r) => r.startsWith("token="));
      if (row) token = row.split("=")[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
        socket.userEmail = decoded.email;
        socket.isAuthenticated = true;
      } catch {
        socket.isAuthenticated = false;
      }
    } else {
      socket.isAuthenticated = false;
    }

    next();
  });

  io.on("connection", (socket) => {
    /** PRESENCIA */
    if (socket.isAuthenticated) {
      addConnectedSocket(socket.userId, socket.id);
      if (connectedUsers.get(socket.userId)?.size === 1) {
        io.emit("user_online", { userId: socket.userId });
      }
    }

    /** AUTO JOIN CHATS */
    if (socket.isAuthenticated) {
      const joinMyChats = async () => {
        const chatIds = await getUserChatIds(socket.userId);
        chatIds.forEach((id) => socket.join(`chat:${id}`));
        await emitUnreadCountToUser(io, socket.userId);
      };

      joinMyChats().catch(() => { });
      socket.on("join_my_chats", joinMyChats);
    }

    socket.on("join_chats", (chatIds = []) => {
      chatIds.forEach((id) => socket.join(`chat:${id}`));
      if (socket.isAuthenticated) {
        emitUnreadCountToUser(io, socket.userId);
      }
    });

    socket.on("typing", ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit("user_typing", {
        chatId,
        userId: socket.userId,
        userEmail: socket.userEmail,
      });
    });

    /** PRODUCT VIEWERS */
    socket.on("join_product", ({ productId, storeOwnerId }) => {
      if (!productId) return;
      if (socket.isAuthenticated && socket.userId === storeOwnerId) return;

      const room = `product:${productId}`;
      socket.join(room);

      if (!productViewers.has(productId)) {
        productViewers.set(productId, {
          authUsers: new Map(),
          anonSockets: new Set(),
        });
      }

      const entry = productViewers.get(productId);

      if (socket.isAuthenticated) {
        if (!entry.authUsers.has(socket.userId)) {
          entry.authUsers.set(socket.userId, new Set());
        }
        entry.authUsers.get(socket.userId).add(socket.id);
      } else {
        entry.anonSockets.add(socket.id);
      }

      socket.data.currentProduct = productId;

      io.to(room).emit("product_viewers_update", {
        productId,
        count: entry.authUsers.size + entry.anonSockets.size,
      });
    });

    socket.on("leave_product", ({ productId }) => {
      const entry = productViewers.get(productId);
      if (!entry) return;

      if (socket.isAuthenticated) {
        const set = entry.authUsers.get(socket.userId);
        if (set) {
          set.delete(socket.id);
          if (set.size === 0) entry.authUsers.delete(socket.userId);
        }
      } else {
        entry.anonSockets.delete(socket.id);
      }

      if (!entry.authUsers.size && !entry.anonSockets.size) {
        productViewers.delete(productId);
      }

      socket.leave(`product:${productId}`);
      socket.data.currentProduct = null;

      io.to(`product:${productId}`).emit("product_viewers_update", {
        productId,
        count: entry.authUsers.size + entry.anonSockets.size,
      });
    });

    /* FIN control de usuarios que están viendo un producto */

    // Usuario se une a una orden (para recibir actualizaciones en tiempo real)
    socket.on("join_order", async ({ orderId }) => {
      const hasAccess = await canAccessOrder({ userId: socket.userId, orderId });
      if (!hasAccess) {
        socket.emit("error", { message: "No tienes acceso a esta orden" });
        return;
      }
      socket.join(`order:${orderId}`);
    });

    // Usuario se une a un delivery (para recibir actualizaciones de posición en tiempo real)
    socket.on("join_delivery", async ({ deliveryId }) => {
      if (!deliveryId) return;

      try {
        const Delivery = require("../models/delivery");
        const delivery = await Delivery.findById(deliveryId).select("orderId").lean();

        if (!delivery?.orderId) {
          socket.emit("error", { message: "Delivery no encontrado" });
          return;
        }

        // Verificar acceso a través de la orden
        const hasAccess = await canAccessOrder({ userId: socket.userId, orderId: delivery.orderId.toString() });
        if (!hasAccess) {
          socket.emit("error", { message: "No tienes acceso a este delivery" });
          return;
        }

        socket.join(`delivery:${deliveryId}`);
      } catch (error) {
        console.error("Error al unirse a delivery:", error);
        socket.emit("error", { message: "Error al unirse al delivery" });
      }
    });

    // Iniciar envío de una orden (cambiar estado a shipped)
    socket.on("start_order_shipping", async ({ orderId }) => {
      try {
        const Order = require("../models/order");
        const Delivery = require("../models/delivery");
        const { startDeliverySimulation } = require("./deliverySimulation");

        const hasAccess = await canAccessOrder({ userId: socket.userId, orderId });

        if (!hasAccess) {
          socket.emit("error", { message: "No tienes acceso a esta orden" });
          return;
        }

        const order = await Order.findById(orderId);
        if (!order) {
          socket.emit("error", { message: "Orden no encontrada" });
          return;
        }

        if (order.status !== "pending") {
          socket.emit("error", { message: "La orden no está en estado pendiente" });
          return;
        }

        // Actualizar estado a shipped
        order.status = "shipped";
        order.statusDates.shipped = new Date();
        await order.save();

        // Emitir actualización a todos los usuarios en la sala de la orden
        io.to(`order:${orderId}`).emit("order_update", {
          orderId,
          status: "shipped",
          statusDates: order.statusDates
        });

        // Buscar el delivery asociado e iniciar la simulación
        const delivery = await Delivery.findOne({ orderId }).select("_id");
        if (delivery) {
          console.log(`🚚 Iniciando simulación de delivery ${delivery._id} para orden ${orderId}`);
          startDeliverySimulation({
            io,
            deliveryId: delivery._id,
            orderId,
            tickMs: 2000
          });
        }
      } catch (error) {
        console.error("Error al iniciar envío:", error);
        socket.emit("error", { message: "Error al actualizar el estado de la orden" });
      }
    });

    /** DISCONNECT */
    socket.on("disconnect", () => {
      if (socket.isAuthenticated) {
        removeConnectedSocket(socket.userId, socket.id);
        if (!connectedUsers.has(socket.userId)) {
          io.emit("user_offline", { userId: socket.userId });
        }
      }

      const productId = socket.data.currentProduct;
      if (!productId) return;

      const entry = productViewers.get(productId);
      if (!entry) return;

      if (socket.isAuthenticated) {
        const set = entry.authUsers.get(socket.userId);
        if (set) {
          set.delete(socket.id);
          if (set.size === 0) entry.authUsers.delete(socket.userId);
        }
      } else {
        entry.anonSockets.delete(socket.id);
      }

      if (!entry.authUsers.size && !entry.anonSockets.size) {
        productViewers.delete(productId);
      }

      io.to(`product:${productId}`).emit("product_viewers_update", {
        productId,
        count: entry.authUsers.size + entry.anonSockets.size,
      });
    });
  });
};

const getIO = () => {
  if (!ioInstance) throw new Error("Socket.IO no inicializado");
  return ioInstance;
};

const isUserConnected = (userId) => connectedUsers.has(userId);

module.exports = {
  setupSocketIO,
  getIO,
  getUserSocketId,
  isUserConnected,
  connectedUsers,
};
