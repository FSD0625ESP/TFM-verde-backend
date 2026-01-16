const mongoose = require("mongoose");
const deliverySchema = new mongoose.Schema(
    {
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
        },
        status: {
            type: String,
            enum: ["pending", "on_route", "delivered"],
            default: "pending",
        },
        origin: {
            lat: { type: Number, required: true },
            lng: { type: Number, required: true },
        },
        destination: {
            lat: { type: Number, required: true },
            lng: { type: Number, required: true },
        },
        route: [
            {
                lat: { type: Number, required: true },
                lng: { type: Number, required: true },
            }
        ],
        currentIndex: { type: Number, default: 0 },
        startedAt: { type: Date, default: null },
        // Estimated Time of Arrival
        eta: { type: Date, default: null },
    },
    {
        timestamps: true,
    }
);
module.exports = mongoose.model("Delivery", deliverySchema);