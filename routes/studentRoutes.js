import express from "express";

import {
  createStudent,
  getAllStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  getMyProfile,
  updateMyProfile,
  getMyStudents,
  getMyStudentById,
} from "../controllers/studentController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import roleMiddleware from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(authMiddleware);


// Get Logged-in Student Profile
// IMPORTANT: /me/profile MUST come before /:id
router.get(
  "/me/profile",
  roleMiddleware("student"),
  getMyProfile
);


// Update Logged-in Student Profile (self only)
router.put(
  "/me/profile",
  roleMiddleware("student"),
  updateMyProfile
);


// Get Students From My Classes
// Teacher Only
// IMPORTANT: /my MUST come before /:id
router.get(
  "/my",
  roleMiddleware("teacher"),
  getMyStudents
);


// Get Single Student From My Classes
// Teacher Only
// IMPORTANT: /my/:id MUST come before /:id
router.get(
  "/my/:id",
  roleMiddleware("teacher"),
  getMyStudentById
);


// Create Student
// Admin Only
router.post(
  "/",
  roleMiddleware("admin"),
  createStudent
);


// Get All Students
// Admin Only (teacher uses /my instead, scoped to their own classes)
router.get(
  "/",
  roleMiddleware("admin"),
  getAllStudents
);


// Get Single Student
// Admin (any student), Teacher (own class only - checked in controller),
// Student (own record only - checked in controller)
router.get(
  "/:id",
  getStudentById
);


// Update Student
// Admin Only
router.put(
  "/:id",
  roleMiddleware("admin"),
  updateStudent
);


// Delete Student
// Admin Only
router.delete(
  "/:id",
  roleMiddleware("admin"),
  deleteStudent
);


export default router;
