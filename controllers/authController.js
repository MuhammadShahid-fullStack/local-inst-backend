import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "../models/User.js";


// ========================================
// Register User
// ========================================

export const register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      department,
    } = req.body;


    // Check required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }


    // Check existing user
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }


    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);


    // Public registration always creates a "student" account.
    // Admin/teacher accounts are created by an existing admin
    // (see Teacher Management and User Management routes).
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "student",
      department: department || "",
    });


    res.status(201).json({
      success: true,
      message: "User registered successfully",

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });

  } catch (error) {

    console.log("Register error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Create First Admin
//
// Bootstraps a fresh database that has zero admin accounts. Once any
// admin exists, this endpoint permanently refuses to create another -
// it is not a general-purpose admin-creation route (that's the
// existing admin-only User Management flow), only a one-time escape
// hatch for a database with no admin at all.
// ========================================

export const createFirstAdmin = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      department,
    } = req.body;


    // Check required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }


    // The entire security model of this endpoint: refuse outright the
    // moment any admin account exists, regardless of who is asking.
    const adminExists = await User.exists({ role: "admin" });

    if (adminExists) {
      return res.status(403).json({
        success: false,
        message: "An admin account already exists. This endpoint is disabled.",
      });
    }


    // Check existing user
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }


    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);


    // role is always "admin" here - never taken from req.body
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "admin",
      department: department || "",
    });


    // Same JWT shape/expiry as login, so the returned token works
    // identically with the existing authMiddleware.
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );


    res.status(201).json({
      success: true,
      message: "First admin account created successfully",

      token,

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });

  } catch (error) {

    console.log("Create first admin error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Login User
// ========================================

export const login = async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;


    // Check required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }


    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }


    // Check password
    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }


    // Create JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );


    res.status(200).json({
      success: true,
      message: "Login successful",

      token,

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });

  } catch (error) {

    console.log("Login error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
// ========================================
// Change Password
// ========================================

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    // Logged-in user only (see authMiddleware on this route)
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const hashedPassword = await bcrypt.hash(
      newPassword,
      10
    );

    user.password = hashedPassword;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });

  } catch (error) {
    console.log("Change password error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};