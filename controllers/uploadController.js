const cloudinary = require("cloudinary").v2;
const multer = require("multer");

// Multer en memoria (necesario para upload_stream)
const storage = multer.memoryStorage();
const upload = multer({ storage });

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_KEY,
  api_secret: process.env.CLOUD_SECRET,
});

exports.uploadProductImage = async (req, res) => {
  try {
    const file = req.file;

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "products",
      },
      (error, result) => {
        if (error) return res.status(500).json({ error });
        res.status(200).json({ url: result.secure_url });
      }
    );

    stream.end(file.buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.uploadMiddleware = upload.single("image");
