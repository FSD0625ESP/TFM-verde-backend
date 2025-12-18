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

router.get("/all", getAllProducts);
router.get("/store/:id", getAllProductsByStoreId);
router.get("/featured", getAllFeaturedProducts);
router.get("/offer", getAllOfferProducts);
router.get("/search", searchProducts);
router.get("/related/:id", getRelatedProducts);
router.get("/product/:id", getProductById);
router.delete(
  "/delete-product/:id/:userId",
  isAuthenticated,
  deleteProductById
);
router.patch("/update-product/:id", isAuthenticated, updateProductById);
router.post("/add", isAuthenticated, createProduct);

exports = module.exports = router;
