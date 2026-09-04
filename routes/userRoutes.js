import express from "express";

import {
  getTeachers,
  createTeacher,
  getAllUsers,
  getUserById,
  updateUserRole,
  deleteUser,
} from "../controllers/userController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import roleMiddleware from "../middleware/roleMiddleware.js";

const router = express.Router();

// ========================================
// All user management routes are Admin only
// ========================================

router.use(authMiddleware, roleMiddleware("admin"));


// Get All Teachers (kept for existing usage)
router.get("/teachers", getTeachers);


// Create Teacher
router.post("/teachers", createTeacher);


// Get All Users (optional ?role= filter)
router.get("/", getAllUsers);


// Get Single User
router.get("/:id", getUserById);


// Update User Role
router.patch("/:id/role", updateUserRole);


// Delete User
router.delete("/:id", deleteUser);


export default router;
