const express = require("express");
const router = express.Router();
const {
  getAllStores,
  getStoreById,
  getStoreBySellerId,
  registerStore,
} = require("../controllers/storeController");

router.get("/all", getAllStores);
router.get("/store/:id", getStoreById);
router.get("/store/seller/:id", getStoreBySellerId);
router.post("/register", registerStore);

exports = module.exports = router;
