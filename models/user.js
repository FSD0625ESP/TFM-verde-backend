const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String },
    password: { type: String, required: function () { return this.provider !== 'google'; } },
    role: { type: String, enum: ['customer', 'seller', 'admin'], default: 'customer' },
    profileImage: { type: String },
    verifiedAt: { type: Date },
    deletedAt: { type: Date },
    provider: { type: String, enum: ['local', 'google'], default: 'local' },
    googleId: { type: String },
}, {
    timestamps: true,
});

module.exports = mongoose.model('User', userSchema);