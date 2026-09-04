import express from "express";

import {
  register,
  login,
  changePassword,
  createFirstAdmin,
} from "../controllers/authController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();


// Register
router.post("/register", register);


// Create First Admin (bootstrap only - self-disables once any admin exists)
router.post("/create-first-admin", createFirstAdmin);


// Login
router.post("/login", login);


// Change Password (logged-in user only)
router.put("/change-password", authMiddleware, changePassword);


export default router;