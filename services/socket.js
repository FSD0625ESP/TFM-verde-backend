const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

// Mapa para rastrear usuarios conectados
const connectedUsers = new Map();

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
        const tokenCookie = cookies.split('; ').find(row => row.startsWith('token='));

        if (!tokenCookie) {
            return next(new Error("Authentication error: No token in cookies"));
        }

        const token = tokenCookie.split('=')[1];

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

        // Desconexión
        socket.on("disconnect", () => {
            connectedUsers.delete(socket.userId);
            io.emit("user_offline", { userId: socket.userId });
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
