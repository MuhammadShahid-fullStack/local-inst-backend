import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import User from "../models/User.js";
import Student from "../models/Student.js";
import Class from "../models/Class.js";


// ========================================
// Shared "class" populate (kept in one
// place so it matches the current Class
// schema: className, teacher, schedule,
// room, status)
// ========================================

const classPopulate = {
  path: "class",
  select: "className teacher schedule room status attendanceWindow",
  populate: {
    path: "teacher",
    select: "name email role",
  },
};


// ========================================
// Create Student
// ========================================

export const createStudent = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      rollNumber,
      phone,
      class: classId,
    } = req.body;

    // Required fields
    if (!name || !email || !password || !rollNumber) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email, password and roll number are required",
      });
    }

    // Validate class id if provided
    if (classId && !mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid class id",
      });
    }

    // Check email
    const existingUser = await User.findOne({ email });

    // A user who self-registered via public signup has a "student"
    // User account but no Student profile yet - that's not a
    // conflict, it's an incomplete enrollment this endpoint should
    // finish. Any other existing user (a different role, or a
    // student who already has a profile) is a genuine conflict.
    let completingExistingUser = false;

    if (existingUser) {
      if (existingUser.role !== "student") {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }

      const existingStudentProfile = await Student.findOne({
        user: existingUser._id,
      });

      if (existingStudentProfile) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }

      completingExistingUser = true;
    }

    // Check roll number
    const existingStudent = await Student.findOne({
      rollNumber,
    });

    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: "Roll number already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    // Create User (or finish enrolling one that already self-registered)
    let user;

    if (completingExistingUser) {
      existingUser.name = name;
      existingUser.password = hashedPassword;
      user = await existingUser.save();
    } else {
      user = await User.create({
        name,
        email,
        password: hashedPassword,
        role: "student",
      });
    }

    // Create Student
    const student = await Student.create({
      user: user._id,
      rollNumber,
      phone,
      class: classId || null,
    });

    // Keep the class's roster in sync
    if (classId) {
      await Class.updateOne(
        { _id: classId },
        { $addToSet: { students: student._id } }
      );
    }

    // Populate class
    await student.populate(classPopulate);

    res.status(201).json({
      success: true,
      message: "Student created successfully",

      student: {
        id: student._id,
        name: user.name,
        email: user.email,
        rollNumber: student.rollNumber,
        phone: student.phone,
        class: student.class,
        status: student.status,
      },
    });

  } catch (error) {
    console.log(
      "Create student error:",
      error.message
    );

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Get All Students
// ========================================

export const getAllStudents = async (req, res) => {
  try {
    const students = await Student.find()
      .populate("user", "name email")
      .populate(classPopulate)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: students.length,
      students,
    });

  } catch (error) {
    console.log(
      "Get students error:",
      error.message
    );

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Get My Students
// Teacher Only - students from the classes
// assigned to the logged-in teacher, and
// ONLY those classes.
// ========================================

export const getMyStudents = async (req, res) => {
  try {
    const myClasses = await Class.find(
      { teacher: req.user.userId },
      "_id"
    );

    const classIds = myClasses.map((c) => c._id);

    if (classIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    const students = await Student.find({
      class: { $in: classIds },
    })
      .populate("user", "name email")
      .populate("class", "className")
      .sort({ createdAt: -1 });

    const data = students.map((student) => ({
      id: student._id,
      name: student.user?.name,
      email: student.user?.email,
      rollNumber: student.rollNumber,
      phone: student.phone,
      className: student.class?.className || null,
      status: student.status,
    }));

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });

  } catch (error) {
    console.log("Get my students error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Get Single Student (Teacher scope)
// Teacher Only - only if the student
// belongs to one of the teacher's classes.
// ========================================

export const getMyStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student id",
      });
    }

    const student = await Student.findById(id)
      .populate("user", "name email")
      .populate("class", "className teacher");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    if (
      !student.class ||
      student.class.teacher.toString() !== req.user.userId
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this student",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: student._id,
        name: student.user?.name,
        email: student.user?.email,
        rollNumber: student.rollNumber,
        phone: student.phone,
        className: student.class.className,
        status: student.status,
      },
    });

  } catch (error) {
    console.log("Get my student error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Get My Profile
// ========================================

export const getMyProfile = async (req, res) => {
  try {
    // JWT se logged-in user ki ID
    const userId = req.user.userId;

    // Student find by user ID
    const student = await Student.findOne({
      user: userId,
    })
      .populate("user", "name email role")
      .populate(classPopulate);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Student profile fetched successfully",
      student,
    });

  } catch (error) {
    console.log(
      "Get my profile error:",
      error.message
    );

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Update My Profile
// Student (self only)
//
// Only basic, self-service fields can be
// changed here. Roll number, class and
// status stay admin-only (updateStudent).
// ========================================

export const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, phone } = req.body;

    if (name === undefined && phone === undefined) {
      return res.status(400).json({
        success: false,
        message: "Provide at least name or phone to update",
      });
    }

    const student = await Student.findOne({
      user: userId,
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    if (phone !== undefined) {
      student.phone = phone;
    }

    await student.save();

    const user = await User.findById(userId);

    if (name !== undefined && user) {
      user.name = name;
      await user.save();
    }

    await student.populate("user", "name email role");
    await student.populate(classPopulate);

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      student,
    });

  } catch (error) {
    console.log(
      "Update my profile error:",
      error.message
    );

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Get Single Student
// Admin can view any student.
// Teacher can only view students in their own classes.
// Student can only view their own record.
// ========================================

export const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student id",
      });
    }

    const student = await Student.findById(id)
      .populate("user", "name email role")
      .populate(classPopulate);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Prevent ID manipulation: a student may only view themselves
    if (
      req.user.role === "student" &&
      student.user._id.toString() !== req.user.userId
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view this student",
      });
    }

    // Teacher may only view students in one of their own classes
    if (
      req.user.role === "teacher" &&
      (!student.class || student.class.teacher._id.toString() !== req.user.userId)
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view this student",
      });
    }

    res.status(200).json({
      success: true,
      student,
    });

  } catch (error) {
    console.log(
      "Get student error:",
      error.message
    );

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Update Student
// Admin Only (enforced in routes)
// ========================================

export const updateStudent = async (req, res) => {
  try {
    const studentId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student id",
      });
    }

    const {
      name,
      email,
      rollNumber,
      phone,
      class: classId,
      status,
    } = req.body;

    if (classId && !mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid class id",
      });
    }

    // Find student
    const student = await Student.findById(
      studentId
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // =========================
    // Update Student Information
    // =========================

    if (rollNumber) {
      student.rollNumber = rollNumber;
    }

    if (phone !== undefined) {
      student.phone = phone;
    }

    if (classId !== undefined) {
      const newClassId = classId || null;
      const oldClassId = student.class ? student.class.toString() : null;

      // Keep both classes' rosters in sync when the class actually changes
      if (String(newClassId) !== oldClassId) {
        if (oldClassId) {
          await Class.updateOne(
            { _id: oldClassId },
            { $pull: { students: student._id } }
          );
        }

        if (newClassId) {
          await Class.updateOne(
            { _id: newClassId },
            { $addToSet: { students: student._id } }
          );
        }
      }

      student.class = newClassId;
    }

    if (status) {
      student.status = status;
    }

    await student.save();

    // =========================
    // Update User Information
    // =========================

    const user = await User.findById(
      student.user
    );

    if (user) {
      if (name) {
        user.name = name;
      }

      if (email) {
        user.email = email;
      }

      await user.save();
    }

    // Populate class again
    await student.populate(classPopulate);

    res.status(200).json({
      success: true,
      message: "Student updated successfully",

      student: {
        id: student._id,
        name: user?.name,
        email: user?.email,
        rollNumber: student.rollNumber,
        phone: student.phone,
        class: student.class,
        status: student.status,
      },
    });

  } catch (error) {
    console.log(
      "Update student error:",
      error.message
    );

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Delete Student
// Admin Only (enforced in routes)
// ========================================

export const deleteStudent = async (req, res) => {
  try {
    const studentId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student id",
      });
    }

    // Find student
    const student = await Student.findById(
      studentId
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Remove from their class's roster, if any
    if (student.class) {
      await Class.updateOne(
        { _id: student.class },
        { $pull: { students: student._id } }
      );
    }

    // Delete Student profile
    await Student.findByIdAndDelete(
      studentId
    );

    // Delete User account
    await User.findByIdAndDelete(
      student.user
    );

    res.status(200).json({
      success: true,
      message: "Student deleted successfully",
    });

  } catch (error) {
    console.log(
      "Delete student error:",
      error.message
    );

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
