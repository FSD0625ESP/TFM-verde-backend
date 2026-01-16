// cron/cleanAbandonedCarts.js
const cron = require("node-cron");
const mongoose = require("mongoose");
const Cart = require("../models/cart");
require("dotenv").config();
const MONGO_URI = process.env.MONGO_URI;

const cleanAbandonedCarts = async () => {
    try {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(MONGO_URI);
        }

        const now = new Date();
        // Carritos anónimos no actualizados en 24 horas
        const anonymousLimit = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        // Carritos de usuario no actualizados en 7 días
        const userLimit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const result = await Cart.updateMany(
            {
                deletedAt: { $exists: false },
                $or: [
                    {
                        userId: null,
                        updatedAt: { $lt: anonymousLimit },
                    },
                    {
                        userId: { $ne: null },
                        updatedAt: { $lt: userLimit },
                    },
                ],
            },
            { $set: { deletedAt: now } }
        );

        console.log(`🧹 Carritos marcados como eliminados: ${result.modifiedCount}`);
    } catch (error) {
        console.error("❌ Error limpiando carritos:", error);
    }
};
// Ejecutar todos los días a las 03:00
cron.schedule("0 3 * * *", cleanAbandonedCarts);
