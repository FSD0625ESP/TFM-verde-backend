const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { isAuthenticated } = require('../middlewares/authMiddleware');

// Crear un reporte (requiere autenticación)
router.post('/', isAuthenticated, reportsController.createReport);

// Obtener todos los reportes (solo admin)
router.get('/', isAuthenticated, reportsController.getAllReports);

// Obtener reportes de una tienda específica (solo admin)
router.get('/store/:storeId', isAuthenticated, reportsController.getReportsByStore);

// Actualizar el estado de un reporte (solo admin)
router.patch('/:reportId/status', isAuthenticated, reportsController.updateReportStatus);

// Eliminar un reporte (solo admin)
router.delete('/:reportId', isAuthenticated, reportsController.deleteReport);

module.exports = router;
