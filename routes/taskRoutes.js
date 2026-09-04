import express from "express";

import {
  createTask,
  getAllTasks,
  getMyTasks,
  getTaskById,
  updateTask,
  deleteTask,
} from "../controllers/taskController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import roleMiddleware from "../middleware/roleMiddleware.js";

const router = express.Router();

// =====================================================
// All task routes require login
// =====================================================

router.use(authMiddleware);


// =====================================================
// Get My Tasks
// Teacher (tasks across their assigned classes) /
// Student (tasks assigned to their own class)
// IMPORTANT: /my MUST come before /:id
// =====================================================

router.get(
  "/my",
  roleMiddleware("student", "teacher"),
  getMyTasks
);


// =====================================================
// Create Task
// Admin / Teacher (own class only - checked in controller)
// =====================================================

router.post(
  "/",
  roleMiddleware("admin", "teacher"),
  createTask
);


// =====================================================
// Get All Tasks
// Admin (all) / Teacher (their own tasks - filtered in controller)
// =====================================================

router.get(
  "/",
  roleMiddleware("admin", "teacher"),
  getAllTasks
);


// =====================================================
// Get Single Task
// Admin / Teacher (any), Student (own class only - checked in controller)
// =====================================================

router.get("/:id", getTaskById);


// =====================================================
// Update Task
// Admin (any) / Teacher (own tasks only - checked in controller)
// =====================================================

router.put(
  "/:id",
  roleMiddleware("admin", "teacher"),
  updateTask
);


// =====================================================
// Delete Task
// Admin (any) / Teacher (own tasks only - checked in controller)
// =====================================================

router.delete(
  "/:id",
  roleMiddleware("admin", "teacher"),
  deleteTask
);


export default router;
