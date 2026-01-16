const Notification = require("../models/notification");

// Obtener notificaciones no leídas del usuario autenticado
const getPendingNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1obtener notificaciones pendientes
    const notifications = await Notification.find({
      userId,
      delivered: false,
      deletedAt: null,
    }).sort({ createdAt: -1 });

    // marcar las notificaciones como entregadas
    if (notifications.length > 0) {
      await Notification.updateMany(
        {
          _id: { $in: notifications.map((n) => n._id) },
        },
        { delivered: true }
      );
    }

    res.json(notifications);
  } catch (err) {
    console.error("❌ Error obteniendo notificaciones:", err);
    res.status(500).json({ error: "Error obteniendo notificaciones" });
  }
};

// Marcar notificaciones como leídas por entityId (por ejemplo, orderId)
// PATCH /notifications/read-by-entity/:orderId
const markNotificationAsReadByEntity = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        userId: req.user._id,
        entityId: req.params.orderId,
      },
      { read: true }
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error actualizando notificación" });
  }
};

module.exports = {
  getPendingNotifications,
  markNotificationAsReadByEntity,
};
