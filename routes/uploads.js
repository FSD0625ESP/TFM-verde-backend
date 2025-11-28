const express = require("express");
const router = express.Router();
const {
  uploadMiddleware,
  uploadProductImage,
} = require("../controllers/uploadController");

router.post("/product/image", uploadMiddleware, uploadProductImage);

module.exports = router;
