const express = require("express");
const router = express.Router();
const {
  getAllProducts,
  getAllFeaturedProducts,
  getAllOfferProducts,
  searchProducts
} = require("../controllers/productController");

router.get("/all", getAllProducts);
router.get("/featured", getAllFeaturedProducts);
router.get("/offer", getAllOfferProducts);
router.post("/search", searchProducts);

exports = module.exports = router;
