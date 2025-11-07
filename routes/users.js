const express = require('express');
const router = express.Router();
const { register, login, me, logout, googleLogin, generateForgotPasswordToken, verifyForgotPasswordToken } = require('../controllers/userController');
const { isAuthenticated } = require('../middlewares/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/me', isAuthenticated, me);
router.patch('/logout', isAuthenticated, logout);
router.post('/generate-forgot-password-token', generateForgotPasswordToken);
router.post('/verify-forgot-password-token', verifyForgotPasswordToken);

exports = module.exports = router;