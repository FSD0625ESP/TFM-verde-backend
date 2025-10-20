const jwt = require('jsonwebtoken');

// Middleware de autenticación
const isAuthenticated = (req, res, next) => {
    // const token = req.header('Authorization');
    const token = req.cookies.token;
    if (!token) return res.status(401).send({ msg: 'No token, authorization denied' });
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).send({ msg: 'Token is not valid' });
        req.user = user;
        next();
    });
};

module.exports = { isAuthenticated };