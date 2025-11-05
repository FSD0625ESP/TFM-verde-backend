const express = require("express");
const router = express.Router();
const {
  getAllProducts,
  getAllFeaturedProducts,
  getAllOfferProducts,
} = require("../controllers/productController");

router.get("/all", getAllProducts);
router.get("/featured", getAllFeaturedProducts);
router.get("/offer", getAllOfferProducts);

exports = module.exports = router;
