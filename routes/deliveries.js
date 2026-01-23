const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middlewares/authMiddleware");
const { getDeliveryByOrderId } = require("../controllers/deliveryController");

router.use(isAuthenticated);

router.get("/order/:orderId", getDeliveryByOrderId);

module.exports = router;
