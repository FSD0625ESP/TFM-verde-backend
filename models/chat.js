const mongoose = require('mongoose');
const store = require('./store');
// Utilizamos desnormalización para optimizar las consultas y evitar joins costosos
const chatSchema = new mongoose.Schema({
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    // ownerId desnormalizado (para consultas rápidas sin tener que resolver storeId -> ownerId)
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Snapshots ligeros para evitar $lookups en listados (se pueden reconstruir si faltan)
    storeSnapshot: {
        _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', default: null },
        name: { type: String, default: '' },
        logo: { type: String, default: '' },
    },
    ownerSnapshot: {
        _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        firstName: { type: String, default: '' },
        lastName: { type: String, default: '' },
        profileImage: { type: String, default: '' },
    },
    customerSnapshot: {
        _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        firstName: { type: String, default: '' },
        lastName: { type: String, default: '' },
        profileImage: { type: String, default: '' },
    },
    // Último mensaje desnormalizado para ordenar y mostrar preview sin leer el array entero
    lastMessage: {
        senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        text: { type: String, default: '' },
        timestamp: { type: Date, default: null },
    },
    // Contadores de no leídos por rol (evita computar por timestamps+filter sobre messages)
    customerUnreadCount: { type: Number, default: 0 },
    ownerUnreadCount: { type: Number, default: 0 },
    messages: [
        {
            senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
            text: { type: String, required: true },
            timestamp: { type: Date, default: Date.now }
        }
    ],
    // Tiempos de última lectura por participante
    customerLastReadAt: { type: Date, default: null },
    ownerLastReadAt: { type: Date, default: null },
    deletedAt: { type: Date },
}, {
    timestamps: true
});

module.exports = mongoose.model('Chat', chatSchema);