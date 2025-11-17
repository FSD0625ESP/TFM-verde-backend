const express = require("express");
const router = express.Router();
const {
  getReviewsByStoreId,
  get,
  getAllReviews,
  getReviewsByProductId,
} = require("../controllers/reviewController");

router.get("/all", getAllReviews);
router.get("/store/:id", getReviewsByStoreId);
router.get("/product/:id", getReviewsByProductId);

exports = module.exports = router;
