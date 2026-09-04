import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

import {
  getTeachersForLeave,
  createLeaveRequest,
  getMyLeaveRequests,
  getTeacherLeaveRequests,
  updateLeaveStatus,
} from "../controllers/leaveController.js";

const router = express.Router();

// Student only
router.get("/teachers", authMiddleware, getTeachersForLeave);
router.post("/", authMiddleware, createLeaveRequest);
router.get("/my", authMiddleware, getMyLeaveRequests);

// Teacher only
router.get("/teacher", authMiddleware, getTeacherLeaveRequests);
router.patch("/:id/status", authMiddleware, updateLeaveStatus);

export default router;