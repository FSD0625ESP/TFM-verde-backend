const express = require("express");
const router = express.Router();
const { getAllStores, registerStore } = require("../controllers/storeController");

router.get("/all", getAllStores);
router.post("/register", registerStore);

exports = module.exports = router;
