const express = require("express");
const router = express.Router();
const {
  uploadMiddleware,
  uploadProductImage,
  deleteProductImage,
  uploadProfileImage,
} = require("../controllers/uploadController");
const { isAuthenticated } = require("../middlewares/authMiddleware");

router.post("/product/image", uploadMiddleware, uploadProductImage);
router.delete("/product/image", isAuthenticated, deleteProductImage);
router.post(
  "/profile/image",
  isAuthenticated,
  uploadMiddleware,
  uploadProfileImage
);

module.exports = router;
