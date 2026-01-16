const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated } = require('../middlewares/authMiddleware');

// Obtener estadísticas globales (solo admin)
router.get('/stats', isAuthenticated, adminController.getGlobalStats);

module.exports = router;
