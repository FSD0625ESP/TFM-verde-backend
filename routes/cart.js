const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");

const { isAuthenticated } = require("../middlewares/authMiddleware");

// Obtener el carrito del usuario
router.get("/", isAuthenticated, cartController.getCart);

// Agregar producto al carrito
router.post("/add", isAuthenticated, cartController.addToCart);

// Actualizar cantidad de un producto
router.put("/update", isAuthenticated, cartController.updateItem);

// Eliminar un producto del carrito
router.delete("/remove", isAuthenticated, cartController.removeItem);

// Vaciar carrito
router.delete("/clear", isAuthenticated, cartController.clearCart);

module.exports = router;
