const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    title: { type: String, required: true },
    slug: { type: String, required: true },
    description: { type: String, required: true },
    longDescription: { type: String, required: true },
    price: { type: Number, required: false },
    images: [
      {
        url: { type: String, required: true },
        public_id: { type: String, required: true },
      },
    ],
    status: {
      type: String,
      enum: ["onSale", "exhibition", "disabled"],
      default: "onSale",
    },
    nuevo: { type: Boolean, default: false },
    oferta: { type: Boolean, default: false },
    destacado: { type: Boolean, default: false },
    stock: { type: Number, required: true },
    views: { type: Number, default: 0 },
    categories: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Category",
      required: true,
    },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ storeId: 1 });
productSchema.index({ categories: 1 });
productSchema.index({ price: 1 });
productSchema.index({ deletedAt: 1 });
module.exports = mongoose.model("Product", productSchema);
