const jwt = require("jsonwebtoken");

// Middleware para autenticación opcional.
// Si el token es válido, añade la información del usuario a req.user.
// Si no hay token o es inválido, continúa sin añadir información de usuario.
const optionalAuth = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return next();

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (!err) {
      req.user = decoded;
    }
    next();
  });
};

module.exports = { optionalAuth };
