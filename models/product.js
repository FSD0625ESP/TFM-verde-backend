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
    images: { type: [String], required: true },
    status: { type: String, enum: ["onSale", "exhibition", "disabled"], default: "onSale" },
    nuevo: { type: Boolean, default: false },
    oferta: { type: Boolean, default: false },
    destacado: { type: Boolean, default: false },
    stock: { type: Number, required: true },
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

module.exports = mongoose.model("Product", productSchema);
