const jwt = require('jsonwebtoken');

// Middleware de autenticación
const isAuthenticated = (req, res, next) => {
    // const token = req.header('Authorization');
    const token = req.cookies.token;
    if (!token) return res.status(401).send({ msg: 'No token, authorization denied' });
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).send({ msg: 'Token is not valid' });
        req.user = user; // user ya contiene { id, role } del token JWT
        console.log('Authenticated user:', req.user);
        next();
    });
};

// Middleware de autenticación opcional (no bloquea si no hay token)
// Útil para rutas que funcionan tanto para usuarios logueados como anónimos
const optionalAuth = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        req.user = null;
        req.sessionId = null;
        return next();
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            req.user = null;
        } else {
            req.user = user;
        }
        next();
    });
};

module.exports = {
    isAuthenticated,
    verifyToken: isAuthenticated, // Alias para compatibilidad
    optionalAuth,
};