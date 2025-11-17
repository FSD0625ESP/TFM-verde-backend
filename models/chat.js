const mongoose = require('mongoose');
const store = require('./store');

const chatSchema = new mongoose.Schema({
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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