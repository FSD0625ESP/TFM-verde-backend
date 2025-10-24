const express = require("express");
const router = express.Router();
const { getAllStores } = require("../controllers/storeController");

router.get("/all", getAllStores);

exports = module.exports = router;
