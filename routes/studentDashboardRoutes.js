import express from "express";

import { getStudentDashboard } from "../controllers/studentDashboardController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import roleMiddleware from "../middleware/roleMiddleware.js";

const router = express.Router();

// ========================================
// Authentication Required
// Student Only (matches every other "my"
// self-service endpoint in this app)
// ========================================

router.use(authMiddleware);

router.get(
  "/",
  roleMiddleware("student"),
  getStudentDashboard
);

export default router;
