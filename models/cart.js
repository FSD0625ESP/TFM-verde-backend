// models/Cart.js
const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      unique: false, // Un usuario puede tener múltiples carritos anónimos
      nullable: true,
    },
    sessionId: {
      type: String,
      required: false,
      unique: true, // Múltiples carritos anónimos permitidos
      nullable: true,
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product", // 🔹 Esto permite hacer populate
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
      },
    ],

    total: {
      type: Number,
      default: 0,
    },

    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// 🔹 Opcional: Método para recalcular total
cartSchema.methods.calculateTotal = function () {
  this.total = this.items.reduce((acc, item) => {
    const price = item.productId?.price || 0; // populate asegura que productId tenga price
    return acc + price * item.quantity;
  }, 0);
};

cartSchema.index({ updatedAt: 1 });
cartSchema.index({ deletedAt: 1 });
cartSchema.index({ userId: 1, updatedAt: 1 });
module.exports = mongoose.model("Cart", cartSchema);
