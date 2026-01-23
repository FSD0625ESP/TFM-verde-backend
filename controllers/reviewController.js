const mongoose = require("mongoose");
const Review = require("../models/review");

/* GET - /all/
   Get all reviews
*/
const getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find({});
    return res.status(200).json(reviews);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

/* GET - /store/:id
   Get STORE reviews by id
*/
const getReviewsByStoreId = async (req, res) => {
  try {
    const reviewsByStoreId = await Review.find({
      storeId: req.params.id,
      deletedAt: null,
    })
      .populate("userId", ["firstName", "lastName"])
      .populate("storeId", ["name"]);
    return res.status(200).json(reviewsByStoreId);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

/* GET - /product/:id
   Get PRODUCT reviews by id
*/
const getReviewsByProductId = async (req, res) => {
  try {
    const reviewsByProductId = await Review.find({
      productId: req.params.id,
      deletedAt: null,
    })
      .populate("productId", "title")
      .populate("userId", ["firstName", "lastName"]);
    return res.status(200).json(reviewsByProductId);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

/* POST - /add/store/
   Add a review to a STORE
*/
const addStoreReview = async (req, res) => {
  try {
    const { userId, storeId, rating, comment } = req.body;
    const newReview = new Review({
      userId: new mongoose.Types.ObjectId(userId),
      storeId: new mongoose.Types.ObjectId(storeId),
      rating,
      comment,
    });
    await newReview.save();
    return res.status(200).json(newReview);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

/* POST - /add/product/
   Add a review to a PRODUCT
*/
const addProductReview = async (req, res) => {
  console.log("backend - addProductReview", req.body);
  try {
    const { userId, productId, rating, comment } = req.body;
    const newReview = new Review({
      userId: new mongoose.Types.ObjectId(userId),
      productId: new mongoose.Types.ObjectId(productId),
      rating,
      comment,
    });
    await newReview.save();
    return res.status(200).json(newReview);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

module.exports = {
  getAllReviews,
  getReviewsByStoreId,
  getReviewsByProductId,
  addStoreReview,
  addProductReview,
};
