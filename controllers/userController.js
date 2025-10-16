const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/User');

// Controlador para el registro de usuarios
const register = async (req, res) => {
    console.log("Registering user:", req.body);
    try {
        const { email, password, firstName, lastName } = req.body;
        // password security checks 
        if (password.length < 6) {
            return res.status(400).send({ msg: 'La contraseña debe tener al menos 6 caracteres' });
        }
        // Verificar que la contraseña tenga al menos una mayúscula, una minúscula y un número
        if (!/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{6,}$/.test(password)) {
            return res.status(400).send({ msg: 'La contraseña debe contener al menos una mayúscula, una minúscula y un número' });
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).send({ msg: 'User already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ email, password: hashedPassword, firstName, lastName });
        const id = await newUser.save();
        jwt.sign({ id: id }, process.env.JWT_SECRET, { expiresIn: '1d' }, (err, token) => {
            if (err) {
                console.error(err);
                return res.status(400).send({ msg: err.message });
            }
            res.status(201).send({ msg: "User registered successfully", token });
        });
    } catch (error) {
        console.error(error);
        return res.status(400).send({ msg: error.message });
    }
};

// Controlador para el login de usuarios
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).send({ msg: 'User not found' });
        console.log("User found:", user);
        const isMatch = await bcrypt.compare(password, user.password)
        console.log("Password match:", isMatch);
        if (!isMatch) return res.status(400).send({ msg: 'Invalid password' });
        jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' }, (err, token) => {
            if (err) {
                console.error(err);
                return res.status(400).send({ msg: err.message });
            }
            res.status(200).send({ token });
        });
    } catch (error) {
        console.error(error);
        return res.status(400).send({ msg: error.message });
    }
};

const me = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).send({ msg: 'User not found' });
        res.status(200).send(user);
    } catch (error) {
        console.error(error);
        return res.status(400).send({ msg: error.message });
    }
};


module.exports = {
    register,
    login,
    me
};
