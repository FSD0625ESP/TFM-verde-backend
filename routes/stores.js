const express = require("express");
const router = express.Router();
const { getAllStores, registerStore, searchStores } = require("../controllers/storeController");

router.get("/all", getAllStores);
router.get("/search", searchStores);
router.post("/register", registerStore);

exports = module.exports = router;
