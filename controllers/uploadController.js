const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const Product = require("../models/product");
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
    if (!file) {
      return res.status(400).json({ error: "No se ha recibido ningún archivo" });
    }

    const uploadToCloudinary = () =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "products",
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );

        stream.end(file.buffer);
      });

    const result = await uploadToCloudinary();

    let updatedProduct = null;
    if (req.body.productId) {
      updatedProduct = await Product.findByIdAndUpdate(
        req.body.productId,
        { $push: { images: result.secure_url } },
        { new: true }
      );
    }

    return res.status(200).json({
      url: result.secure_url,
      product: updatedProduct,
    });
  } catch (err) {
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message });
    }
  }
};

exports.uploadMiddleware = upload.single("image");