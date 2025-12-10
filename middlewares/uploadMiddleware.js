const multer = require("multer");

// Almacenamiento en memoria (se sube directamente a Cloudinary)
const storage = multer.memoryStorage();

// Filtro de archivos
const fileFilter = (req, file, cb) => {
    const allowedMimes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/svg+xml",
    ];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Solo se permiten imágenes (JPEG, PNG, WebP, GIF, SVG)"));
    }
};

// Crear instancia de multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB máximo
    },
});

module.exports = upload;
