const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    reason: { type: String, enum: ['spam', 'inappropriate', 'other'], required: true },
    description: { type: String },
    timestamps: true,
    deletedAt: { type: Date }
});

module.exports = mongoose.model('Report', reportSchema);