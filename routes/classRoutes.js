import express from "express";

import {
  createClass,
  getAllClasses,
  getMyClass,
  getClassById,
  updateClass,
  deleteClass,
  assignTeacher,
  addStudentToClass,
  removeStudentFromClass,
} from "../controllers/classController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import roleMiddleware from "../middleware/roleMiddleware.js";

const router = express.Router();

// ========================================
// All class routes require login
// ========================================

router.use(authMiddleware);


// ========================================
// Get My Class(es)
// Student (own class) / Teacher (assigned classes)
// IMPORTANT: /my MUST come before /:id
// ========================================

router.get(
  "/my",
  roleMiddleware("student", "teacher"),
  getMyClass
);


// ========================================
// Get All Classes
// Admin Only (teacher uses /my instead, scoped to their own classes)
// ========================================

router.get("/", roleMiddleware("admin"), getAllClasses);


// ========================================
// Create Class
// Admin Only
// ========================================

router.post("/", roleMiddleware("admin"), createClass);


// ========================================
// Get Single Class
// Admin / Teacher (any class), Student (own class only - checked in controller)
// ========================================

router.get("/:id", getClassById);


// ========================================
// Update Class
// Admin (full access) / Teacher (their own
// class's GPS attendance config only - enforced
// in the controller, not just this middleware)
// ========================================

router.put("/:id", roleMiddleware("admin", "teacher"), updateClass);


// ========================================
// Delete Class
// Admin Only
// ========================================

router.delete("/:id", roleMiddleware("admin"), deleteClass);


// ========================================
// Assign Teacher to Class
// Admin Only
// ========================================

router.patch(
  "/:id/assign-teacher",
  roleMiddleware("admin"),
  assignTeacher
);


// ========================================
// Add Student to Class
// Admin Only
// ========================================

router.patch(
  "/:id/add-student",
  roleMiddleware("admin"),
  addStudentToClass
);


// ========================================
// Remove Student from Class
// Admin Only
// ========================================

router.patch(
  "/:id/remove-student",
  roleMiddleware("admin"),
  removeStudentFromClass
);


export default router;
