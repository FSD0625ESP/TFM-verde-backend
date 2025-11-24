const express = require("express");
const router = express.Router();
const {
  getAllStores,
  getStoreById,
  registerStore,
} = require("../controllers/storeController");

router.get("/all", getAllStores);
router.get("/store/:id", getStoreById);
router.post("/register", registerStore);

exports = module.exports = router;
