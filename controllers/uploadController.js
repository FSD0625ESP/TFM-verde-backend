const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const Product = require("../models/product");
const User = require("../models/user");
require("dotenv").config();

// Multer en memoria (necesario para upload_stream)
const storage = multer.memoryStorage();
const upload = multer({ storage });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.uploadProductImage = async (req, res) => {
  try {
    const file = req.file;
    const { productId, replace, imageIndex, delete: deleteImage } = req.body;

    if (!productId) {
      return res.status(400).json({ error: "productId requerido" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    /* 🗑️ BORRAR IMAGEN */
    if (deleteImage === "true") {
      if (imageIndex == null) {
        return res.status(400).json({ error: "imageIndex requerido" });
      }

      const img = product.images[imageIndex];
      if (!img) {
        return res.status(404).json({ error: "Imagen no encontrada" });
      }

      await cloudinary.uploader.destroy(img.public_id);

      product.images.splice(imageIndex, 1);
      await product.save();

      return res.status(200).json({
        msg: "Imagen eliminada correctamente",
        images: product.images,
      });
    }

    /* SUBIR / REEMPLAZAR */
    if (!file) {
      return res.status(400).json({ error: "No se recibió imagen" });
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "products" },
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
      stream.end(file.buffer);
    });

    const newImage = {
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
    };

    /* REEMPLAZAR IMAGEN MODIFICADA */
    if (replace === "true") {
      if (imageIndex == null) {
        return res.status(400).json({ error: "imageIndex requerido" });
      }

      const oldImage = product.images[imageIndex];
      if (!oldImage) {
        return res.status(404).json({ error: "Imagen a reemplazar no existe" });
      }

      await cloudinary.uploader.destroy(oldImage.public_id);

      product.images[imageIndex] = newImage;
      await product.save();

      return res.status(200).json({
        msg: "Imagen reemplazada correctamente",
        image: newImage,
      });
    }

    /* AÑADIR NUEVA */
    product.images.push(newImage);
    await product.save();

    return res.status(200).json({
      msg: "Imagen añadida correctamente",
      image: newImage,
    });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message });
    }
  }
};

exports.deleteProductImage = async (req, res) => {
  const { productId, public_id } = req.body;

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ error: "Producto no encontrado" });
  }

  const index = product.images.findIndex((img) => img.public_id === public_id);

  if (index === -1) {
    return res.status(404).json({ error: "Imagen no encontrada" });
  }

  const image = product.images[index];

  await cloudinary.uploader.destroy(image.public_id);

  product.images.splice(index, 1);
  await product.save();

  return res.json({ success: true });
};

exports.uploadProfileImage = async (req, res) => {
  try {
    const file = req.file;
    const userId = req.user.id;

    if (!file) {
      return res
        .status(400)
        .json({ error: "No se ha recibido ningún archivo" });
    }

    // Validar que sea una imagen
    if (!file.mimetype.startsWith("image/")) {
      return res.status(400).json({ error: "El archivo debe ser una imagen" });
    }

    const uploadToCloudinary = () =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "profile-images",
            transformation: [
              { width: 500, height: 500, crop: "fill", gravity: "face" },
            ],
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );

        stream.end(file.buffer);
      });

    const result = await uploadToCloudinary();

    // Actualizar el usuario con la nueva imagen
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profileImage: result.secure_url },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    return res.status(200).json({
      msg: "Imagen de perfil actualizada correctamente",
      url: result.secure_url,
      user: updatedUser,
    });
  } catch (err) {
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message });
    }
  }
};

exports.uploadMiddleware = upload.single("image");

// Helper para subir archivos a Cloudinary (usado por otras rutas)
// Soporta tanto buffer como ruta de archivo
exports.uploadImage = async (fileSource, folder = "uploads") => {
  try {
    let result;

    // Si es un buffer, usar upload_stream
    if (Buffer.isBuffer(fileSource)) {
      result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: folder,
            resource_type: "auto",
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        stream.end(fileSource);
      });
    } else {
      // Si es una ruta, usar upload directo
      result = await cloudinary.uploader.upload(fileSource, {
        folder: folder,
        resource_type: "auto",
      });

      // Limpiar archivo temporal si existe
      if (fileSource && fileSource.startsWith("/")) {
        const fs = require("fs");
        try {
          fs.unlinkSync(fileSource);
        } catch (e) {
          // Ignorar error si no se puede eliminar
        }
      }
    }

    return {
      secure_url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    throw error;
  }
};
