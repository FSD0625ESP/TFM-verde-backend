const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

// Mapa para rastrear usuarios conectados
const connectedUsers = new Map();

// productId => Set(socket.id) mapa de usuarios que están viendo el producto
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
      return next(new Error("Authentication error: No cookies provided"));
    }

    // Parsear las cookies para obtener el token
    const tokenCookie = cookies
      .split("; ")
      .find((row) => row.startsWith("token="));

    if (!tokenCookie) {
      return next(new Error("Authentication error: No token in cookies"));
    }

    const token = tokenCookie.split("=")[1];

    if (!token) {
      return next(new Error("Authentication error: Empty token"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userEmail = decoded.email;
      next();
    } catch (error) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    // Registrar usuario conectado
    connectedUsers.set(socket.userId, socket.id);
    // Notificar presencia
    io.emit("user_online", { userId: socket.userId });

    // Usuario se une a sus salas de chat
    socket.on("join_chats", (chatIds) => {
      chatIds.forEach((chatId) => {
        socket.join(`chat:${chatId}`);
      });
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
        } else if (store?.ownerId?.toString() === socket.userId) {
          chat.ownerLastReadAt = now;
        }
        await chat.save();
        socket.to(`chat:${chatId}`).emit("messages_read", {
          chatId,
          userId: socket.userId,
          at: now,
        });
      } catch (_) {
        // noop
      }
    });

    /* INICIO control de usuarios que están viendo un producto */
    /*
    socket.on("join_product", ({ productId }) => {
      if (!productId) return;

      const room = `product:${productId}`;
      socket.join(room);

      if (!productViewers.has(productId)) {
        productViewers.set(productId, new Set());
      }

      productViewers.get(productId).add(socket.id);
      socket.data.currentProduct = productId;

      io.to(room).emit("product_viewers_update", {
        productId,
        count: productViewers.get(productId).size,
      });
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
    */
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
    const sender = await User.findById(socket.userId).select(
      "firstName lastName avatar"
    );

    if (!sender) {
      return socket.emit("error", { message: "Usuario no encontrado" });
    }

    // Añadir mensaje con ObjectId
    const newMessage = {
      senderId: new mongoose.Types.ObjectId(socket.userId),
      text: text.trim(),
      timestamp: new Date(),
    };

    chat.messages.push(newMessage);
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
