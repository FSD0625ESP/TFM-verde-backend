const jwt = require('jsonwebtoken');

// Middleware de autenticación
const isAuthenticated = (req, res, next) => {
    // Intentar obtener token de cookie primero, luego de Authorization header (fallback)
    let token = req.cookies.token;
    
    if (!token) {
        const authHeader = req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7); // Remover "Bearer "
        }
    }
    
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
    // Intentar obtener token de cookie primero, luego de Authorization header
    let token = req.cookies.token;
    
    if (!token) {
        const authHeader = req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }
    
    if (!token) {
        req.user = null;
        return next();
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            // Si el token es inválido o expiró, limpiarlo para evitar confusión
            console.log('⚠️ Token inválido en optionalAuth, limpiando cookie');
            res.clearCookie("token", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
                path: "/"
            });
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