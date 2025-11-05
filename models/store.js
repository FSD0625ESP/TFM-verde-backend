const mongoose = require("mongoose");

const storeSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    description: { type: String, required: true },
    logo: { type: String },
    image: { type: String },
    categories: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Category",
      required: true,
    },
    billingInfo: {
      name: { type: String },
      address: { type: String },
      phone: { type: String },
      email: { type: String },
    },
    shopOrganizationScheme: { type: String },
    socialLinks: {
      instagram: { type: String },
      facebook: { type: String },
      web: { type: String },
    },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Store", storeSchema);
