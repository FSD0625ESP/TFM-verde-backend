const Chat = require('../models/chat');
const User = require('../models/user');
const Store = require('../models/store');

// Obtener todos los chats del usuario autenticado
exports.getUserChats = async (req, res) => {
    try {
        const userId = req.user.id;

        // Para no romper nada con chats antiguos: seguimos permitiendo resolver rol por storeId
        // pero si el chat ya tiene ownerId/snapshots, la consulta es directa y barata.
        const ownerStores = await Store.find({ ownerId: userId }).select('_id');
        const ownerStoreIds = ownerStores.map(s => s._id);

        const fastChats = await Chat.find({
            $or: [
                { userId: userId },
                { ownerId: userId },
                // fallback legacy: chats sin ownerId todavía
                { storeId: { $in: ownerStoreIds } },
            ],
            deletedAt: null,
        })
            .select(
                '_id storeId ownerId userId storeSnapshot ownerSnapshot customerSnapshot lastMessage customerUnreadCount ownerUnreadCount updatedAt messages'
            )
            .sort({ 'lastMessage.timestamp': -1, updatedAt: -1 })
            .lean();

        const formatted = await Promise.all(
            fastChats.map(async (chat) => {
                const isOwner = (chat.ownerId && chat.ownerId.toString() === userId)
                    || (chat.storeId && ownerStoreIds.some(s => s._id.toString() === chat.storeId.toString()));

                // Si faltan snapshots (chat legacy), reconstruimos una sola vez aquí.
                // Nota: esto no rompe nada y acelera los próximos listados si luego se guarda (no lo hacemos aquí por seguridad).
                let storeSnap = chat.storeSnapshot;
                let ownerSnap = chat.ownerSnapshot;
                let customerSnap = chat.customerSnapshot;
                let ownerId = chat.ownerId;


                // fix para chats legacy sin ownerId o snapshots tras la introducción de desnormalización
                if (!storeSnap?._id || !ownerSnap?._id || !customerSnap?._id || !ownerId) {
                    const store = await Store.findById(chat.storeId).select('name logo ownerId').populate('ownerId', 'firstName lastName profileImage');
                    const customer = await User.findById(chat.userId).select('firstName lastName profileImage');

                    ownerId = store?.ownerId?._id || store?.ownerId || ownerId;
                    storeSnap = {
                        _id: chat.storeId,
                        name: store?.name || '',
                        logo: store?.logo || '',
                    };
                    ownerSnap = store?.ownerId ? {
                        _id: store.ownerId._id,
                        firstName: store.ownerId.firstName || '',
                        lastName: store.ownerId.lastName || '',
                        profileImage: store.ownerId.profileImage || '',
                    } : ownerSnap;
                    customerSnap = customer ? {
                        _id: customer._id,
                        firstName: customer.firstName || '',
                        lastName: customer.lastName || '',
                        profileImage: customer.profileImage || '',
                    } : customerSnap;
                }

                const lastMessage = chat.lastMessage?.timestamp ? {
                    text: chat.lastMessage.text,
                    timestamp: chat.lastMessage.timestamp,
                    senderId: chat.lastMessage.senderId,
                } : (
                    // fallback legacy si aún no existe lastMessage
                    (chat.messages && chat.messages.length > 0) ? {
                        text: chat.messages[chat.messages.length - 1].text,
                        timestamp: chat.messages[chat.messages.length - 1].timestamp,
                        senderId: chat.messages[chat.messages.length - 1].senderId,
                    } : null
                );

                const unreadCount = isOwner
                    ? Number(chat.ownerUnreadCount || 0)
                    : Number(chat.customerUnreadCount || 0);

                const store = {
                    _id: storeSnap?._id || chat.storeId,
                    name: storeSnap?.name || '',
                    logo: storeSnap?.logo || '',
                };

                const user = isOwner ? {
                    _id: customerSnap?._id || chat.userId,
                    firstName: customerSnap?.firstName || '',
                    lastName: customerSnap?.lastName || '',
                    profileImage: customerSnap?.profileImage || '',
                } : {
                    _id: ownerSnap?._id || ownerId,
                    firstName: ownerSnap?.firstName || '',
                    lastName: ownerSnap?.lastName || '',
                    profileImage: ownerSnap?.profileImage || '',
                };

                return {
                    _id: chat._id,
                    store,
                    user,
                    lastMessage,
                    unreadCount,
                };
            })
        );

        res.json(formatted);
    } catch (error) {
        res.status(500).json({ msg: 'Error al obtener los chats' });
    }
};

// Obtener un chat específico con todos los mensajes
exports.getChatById = async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user.id;

        const chat = await Chat.findById(chatId)
            .populate('userId', 'firstName lastName email profileImage')
            .populate({
                path: 'storeId',
                select: 'name logo ownerId',
                populate: {
                    path: 'ownerId',
                    select: 'firstName lastName email profileImage'
                }
            })
            .populate('messages.senderId', 'firstName lastName profileImage');

        if (!chat) {
            return res.status(404).json({ msg: 'Chat no encontrado' });
        }

        // Verificar que el usuario tenga acceso a este chat
        const isOwner = chat.storeId?.ownerId?._id.toString() === userId;
        const isCustomer = chat.userId._id.toString() === userId;

        if (!isOwner && !isCustomer) {
            return res.status(403).json({ msg: 'No tienes acceso a este chat' });
        }

        res.json(chat);
    } catch (error) {
        res.status(500).json({ msg: 'Error al obtener el chat' });
    }
};

// Obtener o crear un chat entre un usuario y una tienda
exports.getOrCreateChat = async (req, res) => {
    try {
        const { storeId } = req.params;
        const userId = req.user.id;

        // Verificar que la tienda existe
        const store = await Store.findById(storeId);
        if (!store) {
            return res.status(404).json({ msg: 'Tienda no encontrada' });
        }

        // Buscar chat existente
        let chat = await Chat.findOne({
            storeId: storeId,
            userId: userId,
            deletedAt: null
        })
            .populate('userId', 'firstName lastName email profileImage')
            .populate({
                path: 'storeId',
                select: 'name logo ownerId',
                populate: {
                    path: 'ownerId',
                    select: 'firstName lastName email profileImage'
                }
            });

        // Si no existe, crear uno nuevo
        if (!chat) {
            const owner = await User.findById(store.ownerId).select('firstName lastName profileImage');
            const customer = await User.findById(userId).select('firstName lastName profileImage');

            chat = new Chat({
                storeId: storeId,
                ownerId: store.ownerId,
                userId: userId,
                storeSnapshot: {
                    _id: store._id,
                    name: store.name || '',
                    logo: store.logo || '',
                },
                ownerSnapshot: owner ? {
                    _id: owner._id,
                    firstName: owner.firstName || '',
                    lastName: owner.lastName || '',
                    profileImage: owner.profileImage || '',
                } : undefined,
                customerSnapshot: customer ? {
                    _id: customer._id,
                    firstName: customer.firstName || '',
                    lastName: customer.lastName || '',
                    profileImage: customer.profileImage || '',
                } : undefined,
                messages: []
            });
            await chat.save();

            // Poblar los datos para la respuesta
            chat = await Chat.findById(chat._id)
                .populate('userId', 'firstName lastName email profileImage')
                .populate({
                    path: 'storeId',
                    select: 'name logo ownerId',
                    populate: {
                        path: 'ownerId',
                        select: 'firstName lastName email profileImage'
                    }
                });

            // Unir a ambos usuarios a la sala del chat vía socket
            const { getUserSocketId } = require('../services/socket');
            const customerSocketId = getUserSocketId(userId);
            const ownerSocketId = getUserSocketId(store.ownerId.toString());

            const { getIO } = require('../services/socket');
            const io = getIO();

            if (customerSocketId) {
                io.to(customerSocketId).emit('join_new_chat', { chatId: chat._id });
            }
            if (ownerSocketId) {
                io.to(ownerSocketId).emit('join_new_chat', { chatId: chat._id });
            }

            console.log(`✨ NEW CHAT CREATED: ${chat._id}, notified users`);
        }

        // Formatear respuesta para que sea consistente con getUserChats
        // El usuario actual (customer) ve al vendedor (owner de la tienda)
        const lastMessage = chat.messages[chat.messages.length - 1];
        const formattedChat = {
            _id: chat._id,
            store: {
                _id: chat.storeId._id,
                name: chat.storeId.name,
                logo: chat.storeId.logo,
            },
            user: {
                _id: chat.storeId.ownerId._id,
                firstName: chat.storeId.ownerId.firstName,
                lastName: chat.storeId.ownerId.lastName,
                profileImage: chat.storeId.ownerId.profileImage,
            },
            lastMessage: lastMessage ? {
                text: lastMessage.text,
                timestamp: lastMessage.timestamp,
                senderId: lastMessage.senderId,
            } : null,
            unreadCount: 0, // Nuevo chat, sin mensajes no leídos
        };

        res.json(formattedChat);
    } catch (error) {
        res.status(500).json({ msg: 'Error al crear el chat' });
    }
};

// Enviar un mensaje en un chat
exports.sendMessage = async (req, res) => {
    try {
        const { chatId } = req.params;
        const { text } = req.body;
        const userId = req.user.id;

        if (!text || text.trim() === '') {
            return res.status(400).json({ msg: 'El mensaje no puede estar vacío' });
        }

        const chat = await Chat.findById(chatId);

        if (!chat) {
            return res.status(404).json({ msg: 'Chat no encontrado' });
        }

        // Verificar que el usuario tenga acceso
        const store = await Store.findById(chat.storeId);
        const isOwner = store.ownerId.toString() === userId;
        const isCustomer = chat.userId.toString() === userId;

        if (!isOwner && !isCustomer) {
            return res.status(403).json({ msg: 'No tienes acceso a este chat' });
        }

        // Añadir mensaje
        const newMessage = {
            senderId: userId,
            text: text.trim(),
            timestamp: new Date()
        };

        chat.messages.push(newMessage);

        // Mantener lastMessage desnormalizado
        chat.lastMessage = {
            senderId: newMessage.senderId,
            text: newMessage.text,
            timestamp: newMessage.timestamp,
        };

        // Incrementar no leídos del receptor (si tenemos ownerId)
        // - Si el que envía es el customer => sube ownerUnreadCount
        // - Si el que envía es el owner => sube customerUnreadCount
        // Nota: si ownerId no está (chat legacy), lo intentamos resolver.
        if (!chat.ownerId) {
            try {
                chat.ownerId = store.ownerId;
            } catch (_) {
                // noop
            }
        }
        if (chat.userId?.toString() === userId) {
            chat.ownerUnreadCount = Number(chat.ownerUnreadCount || 0) + 1;
        } else if (chat.ownerId?.toString() === userId) {
            chat.customerUnreadCount = Number(chat.customerUnreadCount || 0) + 1;
        }

        await chat.save();

        // Poblar el mensaje recién creado
        const populatedChat = await Chat.findById(chatId)
            .populate('messages.senderId', 'firstName lastName profileImage');

        const addedMessage = populatedChat.messages[populatedChat.messages.length - 1];

        res.json(addedMessage);
    } catch (error) {
        res.status(500).json({ msg: 'Error al enviar el mensaje' });
    }
};

// Eliminar (soft delete) un chat
exports.deleteChat = async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user.id;

        const chat = await Chat.findById(chatId).populate('storeId');

        if (!chat) {
            return res.status(404).json({ msg: 'Chat no encontrado' });
        }

        // Verificar que el usuario tenga acceso
        const isOwner = chat.storeId.ownerId.toString() === userId;
        const isCustomer = chat.userId.toString() === userId;

        if (!isOwner && !isCustomer) {
            return res.status(403).json({ msg: 'No tienes acceso a este chat' });
        }

        chat.deletedAt = new Date();
        await chat.save();

        res.json({ msg: 'Chat eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ msg: 'Error al eliminar el chat' });
    }
};
