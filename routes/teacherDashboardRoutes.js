import express from "express";

import {
  getTeacherDashboard,
} from "../controllers/teacherDashboardController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import roleMiddleware from "../middleware/roleMiddleware.js";

const router = express.Router();

// GET /api/teacher/dashboard
router.get(
  "/",
  authMiddleware,
  roleMiddleware("teacher"),
  getTeacherDashboard
);

export default router;