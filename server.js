import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import connectDB from "./config/db.js";

// Routes
import authRoutes from "./routes/authRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import teacherRoutes from "./routes/teacherRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import classRoutes from "./routes/classRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import submissionRoutes from "./routes/submissionRoutes.js";
import teacherDashboardRoutes from "./routes/teacherDashboardRoutes.js";
import studentDashboardRoutes from "./routes/studentDashboardRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";

dotenv.config();

const app = express();

// ========================================
// Middleware
// ========================================

app.use(cors());
app.use(express.json());

// ========================================
// Database
// ========================================

await connectDB();

// ========================================
// Test Route
// ========================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Institute Management System Backend Running",
  });
});

// ========================================
// API Routes
// ========================================

// Authentication
app.use("/api/auth", authRoutes);

// Students
app.use("/api/students", studentRoutes);

// Teachers
app.use("/api/teachers", teacherRoutes);

// Classes
app.use("/api/classes", classRoutes);

// Attendance
app.use("/api/attendance", attendanceRoutes);

// Tasks (admin + teacher, ownership enforced in the controller)
app.use("/api/tasks", taskRoutes);

// Task submissions
app.use("/api/submissions", submissionRoutes);

// Users
app.use("/api/users", userRoutes);

// Teacher dashboard
app.use("/api/teacher/dashboard", teacherDashboardRoutes);

// Student dashboard
app.use("/api/dashboard/student", studentDashboardRoutes);

// Leaves
app.use("/api/leaves", leaveRoutes);

// ========================================
// Start Server
// ========================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});