const express = require('express');
const router = express.Router();
const { register, login, me } = require('../controllers/userController');
const { isAuthenticated } = require('../middlewares/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.get('/me', isAuthenticated, me);

exports = module.exports = router;