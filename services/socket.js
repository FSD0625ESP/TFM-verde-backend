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


const emitToUser = (io, userId, event, payload) => {
  const socketIds = getUserSocketId(userId);
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
const productViewers = new Map();
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
    const tokenCookie = cookies
      .split("; ")
      .find((row) => row.startsWith("token="));

    if (!tokenCookie) {
      return next(new Error("Error de autenticación: no hay token en las cookies"));
    }

    const token = tokenCookie.split("=")[1];

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


    // Usuario está escribiendo
    socket.on("typing", (data) => {
      const { chatId } = data;
      socket.to(`chat:${chatId}`).emit("user_typing", {
        chatId,
        userId: socket.userId,
        userEmail: socket.userEmail,
      });
    });
    if (!productViewers.has(productId)) {
      productViewers.set(productId, new Set());
    }

    productViewers.get(productId).add(socket.id);
    socket.data.currentProduct = productId;

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
        io.to(room).emit("product_viewers_update", {
          productId,
          count: productViewers.get(productId).size,
        });
      };
    });

    socket.on("leave_product", ({ productId }) => {
      const viewers = productViewers.get(productId);
      if (!viewers) return;

      viewers.delete(socket.id);
      socket.leave(`product:${productId}`);

      if (viewers.size === 0) {
        productViewers.delete(productId);
      }

      io.to(`product:${productId}`).emit("product_viewers_update", {
        productId,
        count: viewers.size,
      });

      socket.data.currentProduct = null;
    });

    socket.on("join_product", async ({ productId, storeOwnerId }) => {
      if (!productId) return;

      // ⛔ excluir al owner
      if (storeOwnerId && socket.userId === storeOwnerId) return;

      const room = `product:${productId}`;
      socket.join(room);

      if (!productViewers.has(productId)) {
        productViewers.set(productId, new Map());
      }

      const usersMap = productViewers.get(productId);

      if (!usersMap.has(socket.userId)) {
        usersMap.set(socket.userId, new Set());
      }

      usersMap.get(socket.userId).add(socket.id);

      socket.data.currentProduct = productId;

      io.to(room).emit("product_viewers_update", {
        productId,
        count: usersMap.size, // 👈 usuarios únicos
      });
    });

    socket.on("leave_product", ({ productId }) => {
      const usersMap = productViewers.get(productId);
      if (!usersMap) return;

      const userSockets = usersMap.get(socket.userId);
      if (!userSockets) return;

      userSockets.delete(socket.id);

      if (userSockets.size === 0) {
        usersMap.delete(socket.userId);
      }

      if (usersMap.size === 0) {
        productViewers.delete(productId);
      }

      socket.leave(`product:${productId}`);
      socket.data.currentProduct = null;

      io.to(`product:${productId}`).emit("product_viewers_update", {
        productId,
        count: usersMap.size,
      });
    });

    /* FIN control de usuarios que están viendo un producto */

    // Desconexión
    socket.on("disconnect", () => {
      connectedUsers.delete(socket.userId);
      io.emit("user_offline", { userId: socket.userId });

      /* INICIO control de usuarios que están viendo un producto */
      /*
      const productId = socket.data.currentProduct;
      if (productId) {
        const viewers = productViewers.get(productId);
        if (viewers) {
          viewers.delete(socket.id);
  
          if (viewers.size === 0) {
            productViewers.delete(productId);
          }
  
          io.to(`product:${productId}`).emit("product_viewers_update", {
            productId,
            count: viewers.size,
          });
        }
      }
        */
      const productId = socket.data.currentProduct;
      if (productId) {
        const usersMap = productViewers.get(productId);
        if (usersMap) {
          const userSockets = usersMap.get(socket.userId);
          if (userSockets) {
            userSockets.delete(socket.id);

            if (userSockets.size === 0) {
              usersMap.delete(socket.userId);
            }

            // Desconexión
            socket.on("disconnect", () => {
              removeConnectedSocket(socket.userId, socket.id);
              if (!connectedUsers.has(socket.userId)) {
                io.emit("user_offline", { userId: socket.userId });
              }
            });
            if (usersMap.size === 0) {
              productViewers.delete(productId);
            }

            io.to(`product:${productId}`).emit("product_viewers_update", {
              productId,
              count: usersMap.size,
            });
          }
        }
      }
      /* FIN control de usuarios que están viendo un producto */
    });
  })
};


/**
 * Obtiene el socket ID de un usuario conectado
 * @param {string} userId - ID del usuario
 * @returns {string|undefined} Socket ID del usuario
 */
const getUserSocketId = (userId) => {
  return connectedUsers.get(userId);
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
