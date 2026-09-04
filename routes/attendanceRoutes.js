import express from "express";

import {
  checkIn,
  checkOut,
  markAttendanceByGps,
  markAttendance,
  getAllAttendance,
  getMyAttendance,
  getAttendanceByStudent,
  getMyClassesAttendance,
  getClassAttendance,
  updateAttendance,
  deleteAttendance,
} from "../controllers/attendanceController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import roleMiddleware from "../middleware/roleMiddleware.js";

const router = express.Router();

// ========================================
// Authentication
// ========================================

router.use(authMiddleware);

// ========================================
// Student
// Check in / Check out (self)
// ========================================

router.post(
  "/checkin",
  roleMiddleware("student"),
  checkIn
);

router.post(
  "/checkout",
  roleMiddleware("student"),
  checkOut
);

// ========================================
// Student
// GPS + time-window self attendance
// Separate from /checkin - only works for a
// class with location + attendanceWindow
// configured; /checkin is untouched.
// ========================================

router.post(
  "/mark",
  roleMiddleware("student"),
  markAttendanceByGps
);

// ========================================
// Student
// Get logged-in student's attendance
// Supports optional ?date=YYYY-MM-DD
// ========================================

router.get(
  "/my",
  roleMiddleware("student"),
  getMyAttendance
);

// ========================================
// Teacher
// Attendance for students across ALL of the
// teacher's assigned classes
// Supports optional ?date=YYYY-MM-DD
// ========================================

router.get(
  "/my-classes",
  roleMiddleware("teacher"),
  getMyClassesAttendance
);

// ========================================
// Admin Only
// Get all attendance (institute-wide)
// ========================================

router.get(
  "/",
  roleMiddleware("admin"),
  getAllAttendance
);

// ========================================
// Admin / Teacher
// Get attendance of specific student
// (teacher only if student is in their class)
// ========================================

router.get(
  "/student/:studentId",
  roleMiddleware("admin", "teacher"),
  getAttendanceByStudent
);

// ========================================
// Admin / Teacher
// Class attendance summary
// (teacher only if class is assigned to them)
// Supports optional ?date=YYYY-MM-DD
// ========================================

router.get(
  "/class/:classId",
  roleMiddleware("admin", "teacher"),
  getClassAttendance
);

// ========================================
// Admin / Teacher
// Mark attendance
// (teacher only for students in their own classes)
// ========================================

router.post(
  "/",
  roleMiddleware("admin", "teacher"),
  markAttendance
);

// ========================================
// Admin / Teacher
// Update attendance
// (teacher only for students in their own classes)
// ========================================

router.put(
  "/:id",
  roleMiddleware("admin", "teacher"),
  updateAttendance
);

// ========================================
// Admin Only
// Delete attendance
// ========================================

router.delete(
  "/:id",
  roleMiddleware("admin"),
  deleteAttendance
);

export default router;
