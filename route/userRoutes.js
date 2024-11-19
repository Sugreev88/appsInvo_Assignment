const express = require("express");
const {
  protect,
  createUser,
  changeUserStatus,
  getDistance,
  getUserListing,
} = require("../controller/userController");

const router = express.Router();

router.post("/create", createUser);
router.put("/change-status", protect, changeUserStatus);
router.get("/distance", protect, getDistance);
router.get("/list", protect, getUserListing);

module.exports = router;
