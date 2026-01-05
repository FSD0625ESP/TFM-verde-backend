const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/user");
const TemporalToken = require("../models/temporalToken");
const { OAuth2Client } = require("google-auth-library");
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Controlador para el registro de usuarios
const register = async (req, res) => {
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
    return res.status(400).send({ msg: error.message });
  }
};

// Controlador para el login de usuarios
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).send({ msg: "Usuario no encontrado" });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).send({ msg: "Contraseña inválida" });
    jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
      (err, token) => {
        if (err) {
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
        res.status(200).send({ msg: "Inicio de sesión exitoso", user: safeUser });
      }
    );
  } catch (error) {
    return res.status(400).send({ msg: error.message });
  }
};

const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).send({ msg: "Usuario no encontrado" });
    res.status(200).send(user);
  } catch (error) {
    return res.status(400).send({ msg: error.message });
  }
};

const logout = async (req, res) => {
  try {
    res.clearCookie("token");
    res.status(200).send({ msg: "Cierre de sesión exitoso" });
  } catch (error) {
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
    return res
      .status(400)
      .send({ msg: error.message || "Error al verificar token de Google" });
  }
};

const generateForgotPasswordToken = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).send({ msg: "No se encontro el usuario" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    const temporalToken = new TemporalToken({ userId: user._id, token });
    await temporalToken.save();

    // Enviar email de restablecimiento
    const { sendPasswordResetEmail } = require('../services/emails');
    await sendPasswordResetEmail({
      to: user.email,
      firstName: user.firstName,
      resetToken: token
    });

    res
      .status(200)
      .send({ msg: "Se ha enviado un correo para restablecer la contraseña" });
  } catch (error) {
    console.error(error);
    return res.status(400).send({ msg: error.message });
  }
};

const verifyForgotPasswordToken = async (req, res) => {
  try {
    const { token } = req.body;
    const temporalToken = await TemporalToken.findOne({ token });
    if (!temporalToken)
      return res.status(404).send({ msg: "No se encontro el token" });

    // temporalToken.expiredAt stores the creation time. Consider token expired if older than 1 hour.
    const createdAt = new Date(temporalToken.expiredAt).getTime();
    const ageMs = Date.now() - createdAt;
    const ONE_HOUR_MS = 60 * 60 * 1000;
    if (ageMs > ONE_HOUR_MS) {
      return res.status(404).send({ msg: "El token ha expirado" });
    }

    // opcional: devolver el email asociado para mejorar la UX en frontend
    const user = await User.findById(temporalToken.userId).select('email');
    res.status(200).send({ token, email: user?.email });
  } catch (error) {
    return res.status(400).send({ msg: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const temporalToken = await TemporalToken.findOne({ token });
    if (!temporalToken)
      return res.status(404).send({ msg: "No se encontro el token" });
    const user = await User.findById(temporalToken.userId);
    if (!user)
      return res.status(404).send({ msg: "No se encontro el usuario" });
    // Validar la nueva contraseña
    if (newPassword.length < 6) {
      return res.status(400).send({ msg: "La contraseña debe tener al menos 6 caracteres" });
    }
    if (!/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{6,}$/.test(newPassword)) {
      return res.status(400).send({
        msg: "La contraseña debe contener al menos una mayúscula, una minúscula y un número",
      });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    await TemporalToken.deleteOne({ token });

    res.status(200).send({ msg: "Contraseña cambiada exitosamente" });
  } catch (error) {
    return res.status(400).send({ msg: error.message });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    const userId = req.user.id;

    // Validar que al menos uno de los campos sea proporcionado
    if (!firstName && !lastName) {
      return res.status(400).send({ msg: "Proporciona al menos un campo para actualizar" });
    }

    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).send({ msg: "Usuario no encontrado" });
    }

    res.status(200).send({ msg: "Perfil actualizado exitosamente", user: updatedUser });
  } catch (error) {
    return res.status(400).send({ msg: error.message });
  }
};

const contactForm = async (req, res) => {
  try {
    const { nombre, email, mensaje } = req.body;

    const { sendContactEmail } = require("../services/emails");
    await sendContactEmail({ nombre, email, mensaje });

    console.log(`Nuevo mensaje de contacto de ${nombre} (${email}): ${mensaje}`);
    res.status(200).send({ msg: "Mensaje enviado exitosamente" });
  } catch (error) {
    return res.status(400).send({ msg: error.message });
  }
};


module.exports = {
  register,
  login,
  me,
  logout,
  googleLogin,
  changePassword,
  generateForgotPasswordToken,
  verifyForgotPasswordToken,
  updateUserProfile,
  contactForm,
};
