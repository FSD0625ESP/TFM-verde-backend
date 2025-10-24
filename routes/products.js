const express = require("express");
const router = express.Router();
const { getAllProducts } = require("../controllers/productController");

router.get("/all", getAllProducts);

exports = module.exports = router;
