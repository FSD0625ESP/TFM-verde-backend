const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: false },
    images: { type: [String], required: true },
    status: { type: String, enum: ['onSale', 'exhibition'], default: 'onSale' },
    stock: { type: Number, required: true },
    categories: { type: [mongoose.Schema.Types.ObjectId], ref: 'Category', required: true },
    timpestamps: true,
    deletedAt: { type: Date }
});

module.exports = mongoose.model('Product', productSchema);