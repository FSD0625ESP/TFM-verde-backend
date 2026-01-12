const mongoose = require("mongoose");

const analyticsSchema = new mongoose.Schema(
    {
        eventType: {
            type: String,
            enum: ["view_product", "view_store", "add_to_cart", "purchase"],
            required: true,
        },
        storeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Store",
            required: true,
        },
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
        },
        // Identificación del visitante
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        sessionId: {
            type: String,
        },
        userAgent: {
            type: String,
        },
        // Datos adicionales
        metadata: {
            referrer: { type: String },
            device: { type: String },
            browser: { type: String },
        },
    },
    {
        timestamps: true,
    }
);

// Índices para queries optimizadas del dashboard
analyticsSchema.index({ storeId: 1, createdAt: -1 });
analyticsSchema.index({ storeId: 1, eventType: 1, createdAt: -1 });
analyticsSchema.index({ productId: 1, createdAt: -1 });
analyticsSchema.index({ sessionId: 1, createdAt: -1 });
analyticsSchema.index({ ip: 1, createdAt: -1 });

// Índice compuesto para detectar visitas únicas recientes
analyticsSchema.index({ productId: 1, sessionId: 1, createdAt: -1 });
analyticsSchema.index({ productId: 1, ip: 1, createdAt: -1 });
analyticsSchema.index({ storeId: 1, sessionId: 1, eventType: 1, createdAt: -1 });

module.exports = mongoose.model("Analytics", analyticsSchema);