const express = require('express');
const router = express.Router();
const { register, login, me, logout } = require('../controllers/userController');
const { isAuthenticated } = require('../middlewares/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.get('/me', isAuthenticated, me);
router.get('/logout', isAuthenticated, logout);

exports = module.exports = router;