const mongoose = require('mongoose');
const orderSchema = new mongoose.Schema({
    name: { type: String, required: true },
    timpestamps: true,
    deletedAt: { type: Date }
});

module.exports = mongoose.model('Category', orderSchema);