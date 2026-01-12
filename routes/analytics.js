const express = require("express");
const router = express.Router();
const { optionalAuth } = require("../middlewares/authMiddleware");
const {
    trackEvent,
    getStoreDashboard,
    getProductStats,
} = require("../controllers/analyticsController");

// Ruta pública para registrar eventos (con autenticación opcional)
// Si el usuario está logueado, se asocia su ID al evento
router.post("/track", optionalAuth, trackEvent);

// Rutas protegidas para el dashboard (requieren ser dueño de la tienda)
// Por ahora las dejamos con optionalAuth, luego puedes agregar verificación de ownership
router.get("/dashboard/:storeId", optionalAuth, getStoreDashboard);

// Estadísticas de un producto específico
router.get("/product/:productId", optionalAuth, getProductStats);

module.exports = router;
