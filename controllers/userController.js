const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/user");
const { OAuth2Client } = require("google-auth-library");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Controlador para el registro de usuarios
const register = async (req, res) => {
  console.log("Registering user:", req.body);
  try {
    const { email, password, firstName, lastName } = req.body;
    let { role } = req.body;
    if (role === "admin") role = "customer";
    // password security checks
    if (password.length < 6) {
      return res
        .status(400)
        .send({ msg: "La contraseña debe tener al menos 6 caracteres" });
    }
    // Verificar que la contraseña tenga al menos una mayúscula, una minúscula y un número
    if (!/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{6,}$/.test(password)) {
      return res
        .status(400)
        .send({
          msg: "La contraseña debe contener al menos una mayúscula, una minúscula y un número",
        });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).send({ msg: "User already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
    });
    const savedUser = await newUser.save();
    jwt.sign(
      { id: savedUser._id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
      (err, token) => {
        if (err) {
          console.error(err);
          return res.status(400).send({ msg: err.message });
        }
        // build a safe user object to return (no password)
        const safeUser = savedUser.toObject ? savedUser.toObject() : savedUser;
        delete safeUser.password;
        if (!safeUser.profileImage)
          safeUser.profileImage = "/images/default-avatar.png";

        res.cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 24 * 60 * 60 * 1000, // 1 día
        });
        res
          .status(201)
          .send({ msg: "User registered successfully", user: safeUser });
      }
    );
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
    if (!user) return res.status(400).send({ msg: "User not found" });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).send({ msg: "Invalid password" });
    jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
      (err, token) => {
        if (err) {
          console.error(err);
          return res.status(400).send({ msg: err.message });
        }
        res.cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production", // true en producción
          sameSite: "lax",
          maxAge: 24 * 60 * 60 * 1000, // 1 día
        });
        const safeUser = user.toObject ? user.toObject() : user;
        delete safeUser.password;
        if (!safeUser.profileImage)
          safeUser.profileImage = "/images/default-avatar.png";
        res.status(200).send({ msg: "Login successful", user: safeUser });
      }
    );
  } catch (error) {
    console.error(error);
    return res.status(400).send({ msg: error.message });
  }
};

const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).send({ msg: "User not found" });
    res.status(200).send(user);
  } catch (error) {
    console.error(error);
    return res.status(400).send({ msg: error.message });
  }
};

const logout = async (req, res) => {
  try {
    res.clearCookie("token");
    res.status(200).send({ msg: "Logged out successfully" });
  } catch (error) {
    console.error(error);
    return res.status(400).send({ msg: error.message });
  }
};

// Login/registro con Google OAuth usando idToken del cliente
const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).send({ msg: "Falta idToken" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email;
    const googleId = payload.sub;
    const firstName = payload.given_name || "";
    const lastName = payload.family_name || "";
    const picture = payload.picture;

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        email,
        firstName: firstName || "Usuario",
        lastName: lastName || "Google",
        provider: "google",
        googleId,
        profileImage: picture,
        role: "customer",
      });
      await user.save();
    }

    jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
      (err, token) => {
        if (err) {
          console.error(err);
          return res.status(400).send({ msg: err.message });
        }
        res.cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 24 * 60 * 60 * 1000,
        });
        const safeUser = user.toObject();
        delete safeUser.password;
        return res
          .status(200)
          .send({ msg: "Login con Google exitoso", user: safeUser });
      }
    );
  } catch (error) {
    console.error(error);
    return res
      .status(400)
      .send({ msg: error.message || "Error al verificar token de Google" });
  }
};

const verifyForgotPasswordToken = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).send({ msg: "No se encontro el usuario" });
    // TODO: Aquí generarías un token y enviarías un email al usuario con un enlace para restablecer la contraseña
    res
      .status(200)
      .send({ msg: "Se ha enviado un correo para restablecer la contraseña" });
  } catch (error) {
    console.error(error);
    return res.status(400).send({ msg: error.message });
  }
};

module.exports = {
  register,
  login,
  me,
  logout,
  googleLogin,
  verifyForgotPasswordToken,
};
