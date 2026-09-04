import express from "express";

import {
  submitTask,
  getMySubmissions,
  updateSubmission,
  getTaskSubmissions,
  giveMarks,
  addFeedback,
} from "../controllers/submissionController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import roleMiddleware from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(authMiddleware);


// =====================================================
// Student
// =====================================================

router.post(
  "/",
  roleMiddleware("student"),
  submitTask
);

router.get(
  "/my",
  roleMiddleware("student"),
  getMySubmissions
);

router.put(
  "/:id",
  roleMiddleware("student"),
  updateSubmission
);


// =====================================================
// Admin / Teacher
// =====================================================

router.get(
  "/task/:taskId",
  roleMiddleware("admin", "teacher"),
  getTaskSubmissions
);

router.put(
  "/:id/marks",
  roleMiddleware("admin", "teacher"),
  giveMarks
);

router.put(
  "/:id/feedback",
  roleMiddleware("admin", "teacher"),
  addFeedback
);


export default router;
