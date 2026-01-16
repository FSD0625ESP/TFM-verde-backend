const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

let ioInstance = null;

// Mapa para rastrear usuarios conectados
const connectedUsers = new Map();

// productId => Set(socket.id) mapa de usuarios que están viendo el producto
// productId => {
//   authUsers: Map(userId => Set(socketId))
//   anonSockets: Set(socketId)
// }
const productViewers = new Map();

/**
 * Configura Socket.IO con autenticación y event handlers
 * @param {Server} io - Instancia de Socket.IO
 */
const setupSocketIO = (io) => {
  // Guardar instancia de Socket.IO
  ioInstance = io;

  // Middleware para autenticar sockets
  io.use((socket, next) => {
    // Leer el token desde las cookies HTTP (enviadas automáticamente con withCredentials)
    const cookies = socket.handshake.headers.cookie;

    // Sin autenticación, sockets anónimos existen, pero no pueden enviar mensajes válidos
    // Los chats siguen funcionando porque verifican permisos en el backend
    let token = null;

    if (cookies) {
      const tokenCookie = cookies
        .split("; ")
        .find((row) => row.startsWith("token="));

      if (tokenCookie) {
        token = tokenCookie.split("=")[1];
      }
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

    next(); // 👈 SIEMPRE dejamos pasar
  });

  io.on("connection", (socket) => {
    if (socket.isAuthenticated) {
      // Registrar usuario conectado
      connectedUsers.set(socket.userId, socket.id);
      // Notificar presencia
      io.emit("user_online", { userId: socket.userId });
    }

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
    socket.on("join_product", async ({ productId, storeOwnerId }) => {
      if (!productId) return;

      // excluir owner (solo si está autenticado)
      if (socket.isAuthenticated && socket.userId === storeOwnerId) return;

      const room = `product:${productId}`;
      socket.join(room);

      if (!productViewers.has(productId)) {
        productViewers.set(productId, {
          authUsers: new Map(),
          anonSockets: new Set(),
        });
      }

      // Actualizar el mapa de viewers
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

      const count = entry.authUsers.size + entry.anonSockets.size; // usuarios únicos

      io.to(room).emit("product_viewers_update", {
        productId,
        count,
      });

      console.log("👀 JOIN_PRODUCT", {
        productId,
        isAuth: socket.isAuthenticated,
        userId: socket.userId,
        anonCount: entry.anonSockets.size,
        authCount: entry.authUsers.size,
      });
    });

    socket.on("leave_product", ({ productId }) => {
      if (!productId) return;

      const entry = productViewers.get(productId);
      if (!entry) return;

      if (socket.isAuthenticated) {
        // Usuario autenticado
        const userSockets = entry.authUsers.get(socket.userId);
        if (userSockets) {
          userSockets.delete(socket.id);

          // si el usuario ya no tiene sockets activos en este producto
          if (userSockets.size === 0) {
            entry.authUsers.delete(socket.userId);
          }
        }
      } else {
        // Usuario anónimo
        entry.anonSockets.delete(socket.id);
      }

      // limpiar si el producto se queda vacío
      if (entry.authUsers.size === 0 && entry.anonSockets.size === 0) {
        productViewers.delete(productId);
      }

      socket.leave(`product:${productId}`);
      socket.data.currentProduct = null;

      const count =
        (entry.authUsers?.size || 0) + (entry.anonSockets?.size || 0);

      io.to(`product:${productId}`).emit("product_viewers_update", {
        productId,
        count,
      });
    });

    /* FIN control de usuarios que están viendo un producto */

    // Desconexión
    socket.on("disconnect", () => {
      connectedUsers.delete(socket.userId);
      io.emit("user_offline", { userId: socket.userId });

      /* INICIO control de usuarios que están viendo un producto */
      const productId = socket.data.currentProduct;
      if (!productId) return;

      const entry = productViewers.get(productId);
      if (!entry) return;

      if (socket.isAuthenticated) {
        // Usuario autenticado
        const userSockets = entry.authUsers.get(socket.userId);
        if (userSockets) {
          userSockets.delete(socket.id);

          if (userSockets.size === 0) {
            entry.authUsers.delete(socket.userId);
          }
        }
      } else {
        // Usuario anónimo
        entry.anonSockets.delete(socket.id);
      }

      if (entry.authUsers.size === 0 && entry.anonSockets.size === 0) {
        productViewers.delete(productId);
      }

      const count =
        (entry.authUsers?.size || 0) + (entry.anonSockets?.size || 0);

      io.to(`product:${productId}`).emit("product_viewers_update", {
        productId,
        count,
      });
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
 * Función para obtener la instancia de Socket.IO
 * para poder usarla en otros archivos
 */
const getIO = () => {
  if (!ioInstance) {
    throw new Error("Socket.IO no inicializado");
  }
  return ioInstance;
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
  getIO,
  setupSocketIO,
  getUserSocketId,
  isUserConnected,
  connectedUsers,
};
