const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    reason: { type: String, enum: ['spam', 'inappropriate', 'other'], required: true },
    description: { type: String },
    status: { type: String, enum: ['pending', 'reviewed', 'resolved'], default: 'pending' },
    deletedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);