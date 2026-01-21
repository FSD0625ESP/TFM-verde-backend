const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middlewares/authMiddleware");
const {
  getPendingNotifications,
} = require("../controllers/notificationsController");

// Todas requieren auth
router.use(isAuthenticated);

// GET /notifications/pending
router.get("/pending", isAuthenticated, getPendingNotifications);

module.exports = router;
