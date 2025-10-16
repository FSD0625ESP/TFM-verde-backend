const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['customer', 'seller', 'admin'], default: 'customer' },
    profileImage: { type: String },
    verifiedAt: { type: Date },
    deletedAt: { type: Date },
}, {
    timestamps: true,
});

module.exports = mongoose.model('User', userSchema);