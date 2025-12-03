const express = require("express");
const router = express.Router();
const {
  getReviewsByStoreId,
  get,
  getAllReviews,
  getReviewsByProductId,
  addStoreReview,
  addProductReview,
} = require("../controllers/reviewController");

router.get("/all", getAllReviews);
router.get("/store/:id", getReviewsByStoreId);
router.get("/product/:id", getReviewsByProductId);
router.post("/add/store/", addStoreReview);
router.post("/add/product/", addProductReview);

exports = module.exports = router;
