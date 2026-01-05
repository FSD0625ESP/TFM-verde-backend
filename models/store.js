const mongoose = require("mongoose");

const storeSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    active: { type: Boolean, default: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    description: { type: String, required: true },
    longDescription: { type: String },
    logo: { type: String },
    image: { type: String },
    categories: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Category",
      required: true,
    },
    socialLinks: {
      instagram: { type: String },
      facebook: { type: String },
      web: { type: String },
    },
    billingInfo: {
      name: { type: String },
      address: { type: String },
      phone: { type: String },
      email: { type: String },
    },
    shopOrganizationScheme: { type: String },
    appearance: {
      showFeaturedSection: { type: Boolean, default: true },
      showOfferSection: { type: Boolean, default: true },
      showSlider: { type: Boolean, default: false },
      sliderImages: { type: [String], default: [] },
    },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Store", storeSchema);
