const express = require("express");
const {
  getAllStores,
  getStoreById,
  getStoreBySellerId,
  registerStore,
  searchStores,
  getStoreAppearance,
  updateStoreAppearance,
  uploadStoreImage,
  uploadSliderImage,
  deleteSliderImage,
  getFeaturedProducts,
  getOfferProducts,
  toggleProductFeatured,
  toggleProductOffer,
} = require("../controllers/storeController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");

const router = express.Router();

router.get("/all", getAllStores);
router.get("/search", searchStores);
router.get("/store/:id", getStoreById);
router.get("/store/seller/:id", getStoreBySellerId);
router.post("/register", registerStore);

// ============================================
// APARIENCIA DE TIENDA
// ============================================

// Obtener apariencia de tienda (público)
router.get("/:storeId/appearance", getStoreAppearance);

// Actualizar apariencia de tienda
router.patch("/:storeId/appearance", isAuthenticated, updateStoreAppearance);

// Subir imagen destacada de tienda
router.post("/:storeId/image", isAuthenticated, upload.single("image"), uploadStoreImage);

// Subir imagen al slider
router.post("/:storeId/slider", isAuthenticated, upload.single("image"), uploadSliderImage);

// Eliminar imagen del slider
router.delete("/:storeId/slider/:imageUrl", isAuthenticated, deleteSliderImage);

// ============================================
// PRODUCTOS DESTACADOS Y OFERTAS
// ============================================

// Obtener productos destacados de una tienda
router.get("/:storeId/featured-products", getFeaturedProducts);

// Obtener productos en oferta de una tienda
router.get("/:storeId/offer-products", getOfferProducts);

// Marcar/desmarcar producto como destacado
router.patch("/products/:productId/featured", isAuthenticated, toggleProductFeatured);

// Actualizar estado de oferta de un producto
router.patch("/products/:productId/offer", isAuthenticated, toggleProductOffer);

exports = module.exports = router;
