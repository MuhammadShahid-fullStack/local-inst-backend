import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import User from "../models/User.js";
import Student from "../models/Student.js";
import Class from "../models/Class.js";

const ALLOWED_ROLES = ["admin", "teacher", "student"];

// ========================================
// Get All Teachers
// ========================================

export const getTeachers = async (req, res) => {
  try {
    const teachers = await User.find(
      { role: "teacher" },
      "name email role department"
    ).sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: teachers.length,
      teachers,
    });

  } catch (error) {
    console.error("Get teachers error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Create Teacher
// Admin Only
//
// role is always "teacher" here - never taken from the client, so an
// admin cannot be tricked (or trick themselves) into creating a user
// with an arbitrary role through this endpoint.
// ========================================

export const createTeacher = async (req, res) => {
  try {
    const { name, email, password, department } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "teacher",
      department: department || "",
    });

    res.status(201).json({
      success: true,
      message: "Teacher created successfully",

      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        createdAt: user.createdAt,
      },
    });

  } catch (error) {
    console.log("Create teacher error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Get All Users
// Admin Only
// Optional query: ?role=admin|teacher|student
// ========================================

export const getAllUsers = async (req, res) => {
  try {
    const { role } = req.query;

    const filter = {};

    if (role) {
      if (!ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role filter",
        });
      }

      filter.role = role;
    }

    const users = await User.find(
      filter,
      "name email role department createdAt updatedAt"
    ).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });

  } catch (error) {
    console.log("Get all users error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Get Single User
// Admin Only
// ========================================

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id",
      });
    }

    const user = await User.findById(
      id,
      "name email role department createdAt updatedAt"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });

  } catch (error) {
    console.log("Get user error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Update User Role
// Admin Only
// ========================================

export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id",
      });
    }

    if (!role || !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Valid role is required (admin, teacher or student)",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.role = role;

    await user.save();

    res.status(200).json({
      success: true,
      message: "User role updated successfully",

      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });

  } catch (error) {
    console.log("Update user role error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Delete User
// Admin Only
// ========================================

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent an admin from deleting their own account by mistake
    if (id === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    // A teacher with assigned classes can't be deleted - it would
    // leave those classes pointing at a nonexistent teacher and
    // crash class/task/attendance ownership checks. Reassign or
    // delete those classes first.
    if (user.role === "teacher") {
      const hasClasses = await Class.exists({ teacher: id });

      if (hasClasses) {
        return res.status(400).json({
          success: false,
          message:
            "This teacher has assigned classes. Reassign or delete those classes before deleting the teacher.",
        });
      }
    }

    await User.findByIdAndDelete(id);

    // Keep Student profiles and class rosters from pointing at a deleted user
    if (user.role === "student") {
      const student = await Student.findOneAndDelete({ user: id });

      if (student?.class) {
        await Class.updateOne(
          { _id: student.class },
          { $pull: { students: student._id } }
        );
      }
    }

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });

  } catch (error) {
    console.log("Delete user error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
