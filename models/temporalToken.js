const mongoose = require('mongoose');

const temporalTokenSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true },
    expiredAt: { type: Date, default: Date.now, expires: 3600 }
});

module.exports = mongoose.model('TemporalToken', temporalTokenSchema);