const express = require("express");
const router = express.Router();
const {
  getAllProducts,
  getAllFeaturedProducts,
  getAllOfferProducts,
  getProductById,
  searchProductsFunction,
  searchProducts,
} = require("../controllers/productController");

router.get("/all", getAllProducts);
router.get("/featured", getAllFeaturedProducts);
router.get("/offer", getAllOfferProducts);
router.get("/search", searchProducts);
router.get("/:id", getProductById);

exports = module.exports = router;
