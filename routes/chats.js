const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { verifyToken } = require('../middlewares/authMiddleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Obtener todos los chats del usuario
router.get('/', chatController.getUserChats);

// Obtener o crear un chat con una tienda
router.get('/store/:storeId', chatController.getOrCreateChat);

// Obtener un chat específico
router.get('/:chatId', chatController.getChatById);

// Enviar un mensaje en un chat
router.post('/:chatId/messages', chatController.sendMessage);

// Eliminar un chat
router.delete('/:chatId', chatController.deleteChat);

module.exports = router;
