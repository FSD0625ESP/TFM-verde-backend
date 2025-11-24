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
} = require("../controllers/productController");

router.get("/all", getAllProducts);
router.get("/store/:id", getAllProductsByStoreId);
router.get("/featured", getAllFeaturedProducts);
router.get("/offer", getAllOfferProducts);
router.get("/search", searchProducts);
router.get("/product/:id", getProductById);

exports = module.exports = router;
