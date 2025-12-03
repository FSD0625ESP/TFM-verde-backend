const express = require('express');
const router = express.Router();
const {
    getUserAddresses,
    getAddressById,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress
} = require('../controllers/addressController');
const { isAuthenticated } = require('../middlewares/authMiddleware');

// Todas las rutas requieren autenticación
router.use(isAuthenticated);

// Obtener todas las direcciones del usuario
router.get('/', getUserAddresses);

// Obtener una dirección específica
router.get('/:id', getAddressById);

// Crear una nueva dirección
router.post('/', createAddress);

// Actualizar una dirección
router.patch('/:id', updateAddress);

// Eliminar una dirección
router.delete('/:id', deleteAddress);

// Establecer como dirección predeterminada
router.patch('/:id/set-default', setDefaultAddress);

module.exports = router;
