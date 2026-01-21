const express = require("express");
const router = express.Router();
const {
  getAllProducts,
  getAllProductsByStoreId,
  getAllFeaturedProducts,
  getAllOfferProducts,
  getProductById,
  deleteProductById,
  updateProductById,
  searchProductsFunction,
  searchProducts,
  createProduct,
  getRelatedProducts,
} = require("../controllers/productController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const { optionalAuth } = require("../middlewares/optionalAuth");

router.get("/all", getAllProducts);
router.get("/store/:id", getAllProductsByStoreId);
router.get("/featured", optionalAuth, getAllFeaturedProducts);
router.get("/offer", optionalAuth, getAllOfferProducts);
router.get("/search", optionalAuth, searchProducts);
router.get("/related/:id", optionalAuth, getRelatedProducts);
router.get("/product/:id", optionalAuth, getProductById);
router.delete(
  "/delete-product/:id/:userId",
  isAuthenticated,
  deleteProductById
);
router.patch("/update-product/:id", isAuthenticated, updateProductById);
router.post("/add", isAuthenticated, createProduct);

exports = module.exports = router;
