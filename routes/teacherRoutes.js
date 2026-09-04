import express from "express";

import {
  getMyProfile,
  updateMyProfile,
} from "../controllers/teacherController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import roleMiddleware from "../middleware/roleMiddleware.js";

const router = express.Router();

// ========================================
// Authentication + Teacher Only
// ========================================

router.use(authMiddleware, roleMiddleware("teacher"));


// Get Logged-in Teacher Profile
router.get("/me/profile", getMyProfile);


// Update Logged-in Teacher Profile (self only)
router.put("/me/profile", updateMyProfile);


export default router;
