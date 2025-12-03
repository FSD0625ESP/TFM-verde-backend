const express = require("express");
const router = express.Router();
const {
  getAllProducts,
  getAllProductsByStoreId,
  getAllFeaturedProducts,
  getAllOfferProducts,
  getProductById,
  searchProductsFunction,
  searchProducts,
  createProduct
} = require("../controllers/productController");
const { isAuthenticated } = require("../middlewares/authMiddleware");

router.get("/all", getAllProducts);
router.get("/store/:id", getAllProductsByStoreId);
router.get("/featured", getAllFeaturedProducts);
router.get("/offer", getAllOfferProducts);
router.get("/search", searchProducts);
router.get("/product/:id", getProductById);
router.post("/add", isAuthenticated, createProduct);

exports = module.exports = router;
