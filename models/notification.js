const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    // Usuario que recibe la notificación (vendedor)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Tienda relacionada (útil para filtrar por tienda)
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },

    // Tipo de notificación
    type: {
      type: String,
      enum: [
        "new_order",
        // "order_canceled",
        // "order_status_changed",
        // "new_message",
      ],
      required: true,
      index: true,
    },

    // Entidad relacionada (orderId, chatId, etc.)
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    // ¿el vendedor ya la ha visto?
    read: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ¿ya se envió por socket?
    delivered: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Soft delete
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Notification", notificationSchema);
