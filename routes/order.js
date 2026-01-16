const express = require("express");
const router = express.Router();
const {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  getAdminOrders,
} = require("../controllers/orderController");
const { isAuthenticated } = require("../middlewares/authMiddleware");

// Todas las rutas requieren autenticación
router.use(isAuthenticated);

// Obtener todas las órdenes del usuario
router.get("/",isAuthenticated, getOrders);
router.get("/admin", isAuthenticated, getAdminOrders);

// Obtener una orden específica
router.get("/:id", isAuthenticated, getOrderById);

// Crear una nueva orden  
router.post("/", createOrder);

// Actualizar una orden (ej. status)
router.patch("/:id", updateOrder);

// Eliminar una orden (soft delete)
router.delete("/:id", deleteOrder);

module.exports = router;
