const Chat = require('../models/chat');
const User = require('../models/user');
const Store = require('../models/store');

// Obtener todos los chats del usuario autenticado
exports.getUserChats = async (req, res) => {
    try {
        const userId = req.user.id;

        // Buscar chats donde el usuario es participante
        const chats = await Chat.find({
            $or: [
                { userId: userId },
                { 'storeId': { $in: await Store.find({ ownerId: userId }).select('_id') } }
            ],
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
            })
            .sort({ 'messages.timestamp': -1 });

        // Formatear los chats para el frontend
        const formattedChats = chats.map(chat => {
            const lastMessage = chat.messages[chat.messages.length - 1];
            const isOwner = chat.storeId?.ownerId?._id.toString() === userId;

            // Calcular no leídos para el usuario actual
            const lastReadAt = isOwner ? chat.ownerLastReadAt : chat.customerLastReadAt;
            const unreadCount = chat.messages.filter(m => {
                const isFromOther = m.senderId.toString() !== userId;
                const isNew = !lastReadAt || new Date(m.timestamp) > new Date(lastReadAt);
                return isFromOther && isNew;
            }).length;

            return {
                _id: chat._id,
                store: {
                    _id: chat.storeId._id,
                    name: chat.storeId.name,
                    logo: chat.storeId.logo,
                },
                user: isOwner ? {
                    _id: chat.userId._id,
                    firstName: chat.userId.firstName,
                    lastName: chat.userId.lastName,
                    profileImage: chat.userId.profileImage,
                } : {
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
                unreadCount,
            };
        });

        res.json(formattedChats);
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
            chat = new Chat({
                storeId: storeId,
                userId: userId,
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
        }

        res.json(chat);
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
