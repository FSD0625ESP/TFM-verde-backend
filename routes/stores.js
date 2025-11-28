const express = require("express");
const {
  getAllStores,
  getStoreById,
  getStoreBySellerId,
  registerStore,
  searchStores,
} = require("../controllers/storeController");
const router = express.Router();

router.get("/all", getAllStores);
router.get("/search", searchStores);

router.get("/store/:id", getStoreById);
router.get("/store/seller/:id", getStoreBySellerId);
router.post("/register", registerStore);

exports = module.exports = router;
