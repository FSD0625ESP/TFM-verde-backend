const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");

const { isAuthenticated, optionalAuth } = require("../middlewares/authMiddleware");

// Obtener el carrito del usuario
router.get("/", optionalAuth, cartController.getCart);

// Agregar producto al carrito
router.post("/add", optionalAuth, cartController.addToCart);

// Actualizar cantidad de un producto
router.put("/update", optionalAuth, cartController.updateItem);

// Eliminar un producto del carrito
router.delete("/remove", optionalAuth, cartController.removeItem);

// Vaciar carrito
router.delete("/clear", optionalAuth, cartController.clearCart);

// Reemplazar carrito anónimo por carrito de usuario (login/registro)
router.post("/replace", isAuthenticated, cartController.replaceAnonymousCart);

module.exports = router;
