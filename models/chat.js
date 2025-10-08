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
    timestamps: true,
    deletedAt: { type: Date }
});

module.exports = mongoose.model('Chat', chatSchema);