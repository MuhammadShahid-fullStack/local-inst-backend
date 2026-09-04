import mongoose from "mongoose";

import Class from "../models/Class.js";
import User from "../models/User.js";
import Student from "../models/Student.js";
import Task from "../models/Task.js";
import Submission from "../models/Submission.js";

const studentPopulate = {
  path: "students",
  select: "rollNumber user status",
  populate: {
    path: "user",
    select: "name email",
  },
};

// ========================================
// GPS Attendance Config Validation
// Shared by createClass and updateClass.
// Both return null when valid (including when
// the field is simply not being configured), or
// a message string describing what's wrong.
// ========================================

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIME_FORMAT = /^([01]\d|2[0-3]):([0-5]\d)$/;

const validateLocation = (location) => {
  // Not present in the request, or explicitly cleared - both fine.
  if (location === undefined || location === null) {
    return null;
  }

  const { latitude, longitude, radius } = location;

  const providedCount = [latitude, longitude, radius].filter(
    (value) => value !== undefined && value !== null
  ).length;

  // An empty object (nothing set) is treated the same as "not configured".
  if (providedCount === 0) {
    return null;
  }

  if (providedCount < 3) {
    return "latitude, longitude and radius must all be provided together";
  }

  if (typeof latitude !== "number" || latitude < -90 || latitude > 90) {
    return "Invalid latitude";
  }

  if (typeof longitude !== "number" || longitude < -180 || longitude > 180) {
    return "Invalid longitude";
  }

  if (typeof radius !== "number" || radius < 1 || radius > 5000) {
    return "Invalid radius";
  }

  return null;
};

const validateAttendanceWindow = (attendanceWindow) => {
  if (attendanceWindow === undefined || attendanceWindow === null) {
    return null;
  }

  const { startTime, endTime, days } = attendanceWindow;

  const hasAnyValue = startTime || endTime || (days && days.length > 0);

  if (!hasAnyValue) {
    return null;
  }

  if (!startTime || !TIME_FORMAT.test(startTime)) {
    return "startTime must be in HH:MM 24-hour format";
  }

  if (!endTime || !TIME_FORMAT.test(endTime)) {
    return "endTime must be in HH:MM 24-hour format";
  }

  if (startTime >= endTime) {
    return "startTime must be earlier than endTime";
  }

  if (!Array.isArray(days) || days.length === 0) {
    return "At least one attendance day is required";
  }

  const invalidDay = days.find((day) => !WEEKDAYS.includes(day));

  if (invalidDay) {
    return `Invalid weekday: ${invalidDay}`;
  }

  if (new Set(days).size !== days.length) {
    return "days must not contain duplicate values";
  }

  return null;
};

// ========================================
// Create Class
// Admin Only
// ========================================

export const createClass = async (req, res) => {
  try {
    const {
      className,
      teacher,
      schedule,
      room,
      status,
      location,
      attendanceWindow,
    } = req.body;

    // Required fields
    if (!className || !teacher || !schedule || !room) {
      return res.status(400).json({
        success: false,
        message:
          "Class name, teacher, schedule and room are required",
      });
    }

    // Valid teacher id
    if (!mongoose.Types.ObjectId.isValid(teacher)) {
      return res.status(400).json({
        success: false,
        message: "Invalid teacher id",
      });
    }

    // Teacher must exist and have role "teacher"
    const teacherUser = await User.findById(teacher);

    if (!teacherUser || teacherUser.role !== "teacher") {
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }

    // GPS attendance config is optional - only validated if provided
    const locationError = validateLocation(location);

    if (locationError) {
      return res.status(400).json({
        success: false,
        message: locationError,
      });
    }

    const windowError = validateAttendanceWindow(attendanceWindow);

    if (windowError) {
      return res.status(400).json({
        success: false,
        message: windowError,
      });
    }

    const newClass = await Class.create({
      className,
      teacher,
      schedule,
      room,
      status: status || "active",
      ...(location !== undefined && { location }),
      ...(attendanceWindow !== undefined && { attendanceWindow }),
    });

    await newClass.populate("teacher", "name email role");

    res.status(201).json({
      success: true,
      message: "Class created successfully",
      data: newClass,
    });

  } catch (error) {
    console.log("Create class error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Get All Classes
// Admin / Teacher
// ========================================

export const getAllClasses = async (req, res) => {
  try {
    const classes = await Class.find()
      .populate("teacher", "name email role")
      .populate(studentPopulate)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: classes.length,
      data: classes,
    });

  } catch (error) {
    console.log("Get classes error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Get My Class(es)
// Student -> their single assigned class
// Teacher -> array of classes they teach
// ========================================

export const getMyClass = async (req, res) => {
  try {
    // Teacher: all classes where they are the assigned teacher
    if (req.user.role === "teacher") {
      const classes = await Class.find({
        teacher: req.user.userId,
      })
        .populate("teacher", "name email role")
        .populate(studentPopulate)
        .sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        classes,
      });
    }

    // Student: their own single assigned class (unchanged behavior)
    const student = await Student.findOne({
      user: req.user.userId,
    }).populate({
      path: "class",
      populate: [
        { path: "teacher", select: "name email role" },
        studentPopulate,
      ],
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    if (!student.class) {
      return res.status(404).json({
        success: false,
        message: "No class assigned yet",
      });
    }

    res.status(200).json({
      success: true,
      data: student.class,
    });

  } catch (error) {
    console.log("Get my class error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Get Single Class
// Admin (any class)
// Teacher (only their own assigned class)
// Student (only their own assigned class)
// ========================================

export const getClassById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid class id",
      });
    }

    const classData = await Class.findById(id)
      .populate("teacher", "name email role")
      .populate(studentPopulate);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // Students can only view their own assigned class
    if (req.user.role === "student") {
      const student = await Student.findOne({
        user: req.user.userId,
      });

      if (
        !student ||
        !student.class ||
        student.class.toString() !== id
      ) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to view this class",
        });
      }
    }

    // Teachers can only view classes assigned to them
    if (
      req.user.role === "teacher" &&
      classData.teacher._id.toString() !== req.user.userId
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view this class",
      });
    }

    res.status(200).json({
      success: true,
      data: classData,
    });

  } catch (error) {
    console.log("Get single class error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Update Class
// Admin: full access to every field below.
// Teacher: their own assigned class ONLY, and
// ONLY its GPS attendance config (location /
// attendanceWindow) - never basic class info,
// and never a class assigned to someone else.
// ========================================

export const updateClass = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid class id",
      });
    }

    const classData = await Class.findById(id);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    const isTeacher = req.user.role === "teacher";

    // Ownership is resolved from the JWT (req.user.userId), never from
    // anything the client sends - a teacher can never claim another
    // teacher's class by supplying a different id in the body.
    if (isTeacher && classData.teacher.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update this class",
      });
    }

    const {
      className,
      teacher,
      schedule,
      room,
      status,
      location,
      attendanceWindow,
    } = req.body;

    // Basic class info and teacher reassignment stay admin-only, even
    // on this same endpoint - a teacher's request simply never applies
    // these fields, regardless of what's in the body.
    if (!isTeacher) {
      // Validate teacher if being changed
      if (teacher !== undefined) {
        if (!mongoose.Types.ObjectId.isValid(teacher)) {
          return res.status(400).json({
            success: false,
            message: "Invalid teacher id",
          });
        }

        const teacherUser = await User.findById(teacher);

        if (!teacherUser || teacherUser.role !== "teacher") {
          return res.status(404).json({
            success: false,
            message: "Teacher not found",
          });
        }

        classData.teacher = teacher;
      }

      if (className !== undefined) {
        classData.className = className;
      }

      if (schedule !== undefined) {
        classData.schedule = schedule;
      }

      if (room !== undefined) {
        classData.room = room;
      }

      if (status !== undefined) {
        classData.status = status;
      }
    }

    // GPS attendance config - available to admin (any class) and
    // teacher (their own class only, enforced above).
    const locationError = validateLocation(location);

    if (locationError) {
      return res.status(400).json({
        success: false,
        message: locationError,
      });
    }

    const windowError = validateAttendanceWindow(attendanceWindow);

    if (windowError) {
      return res.status(400).json({
        success: false,
        message: windowError,
      });
    }

    if (location !== undefined) {
      classData.location = location;
    }

    if (attendanceWindow !== undefined) {
      classData.attendanceWindow = attendanceWindow;
    }

    await classData.save();

    await classData.populate("teacher", "name email role");
    await classData.populate(studentPopulate);

    res.status(200).json({
      success: true,
      message: "Class updated successfully",
      data: classData,
    });

  } catch (error) {
    console.log("Update class error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Delete Class
// Admin Only
// ========================================

export const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid class id",
      });
    }

    const classData = await Class.findById(id);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // Unassign this class from any students who had it
    await Student.updateMany(
      { class: id },
      { class: null }
    );

    // Remove tasks (and their submissions) that belonged to this
    // class - otherwise they'd point at a deleted class and crash
    // anything that later reads task.assignedClass
    const orphanedTasks = await Task.find({ assignedClass: id }, "_id");
    const orphanedTaskIds = orphanedTasks.map((t) => t._id);

    if (orphanedTaskIds.length > 0) {
      await Submission.deleteMany({ task: { $in: orphanedTaskIds } });
      await Task.deleteMany({ assignedClass: id });
    }

    await Class.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Class deleted successfully",
    });

  } catch (error) {
    console.log("Delete class error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Assign Teacher to Class
// Admin Only
// ========================================

export const assignTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const { teacherId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid class id",
      });
    }

    if (!teacherId || !mongoose.Types.ObjectId.isValid(teacherId)) {
      return res.status(400).json({
        success: false,
        message: "Valid teacherId is required",
      });
    }

    const classData = await Class.findById(id);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    const teacherUser = await User.findById(teacherId);

    if (!teacherUser || teacherUser.role !== "teacher") {
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }

    classData.teacher = teacherId;

    await classData.save();

    await classData.populate("teacher", "name email role");
    await classData.populate(studentPopulate);

    res.status(200).json({
      success: true,
      message: "Teacher assigned successfully",
      data: classData,
    });

  } catch (error) {
    console.log("Assign teacher error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Add Student to Class
// Admin Only
// ========================================

export const addStudentToClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid class id",
      });
    }

    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Valid studentId is required",
      });
    }

    const classData = await Class.findById(id);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Already in this class
    const alreadyInClass = classData.students.some(
      (s) => s.toString() === studentId
    );

    if (alreadyInClass) {
      return res.status(400).json({
        success: false,
        message: "Student is already in this class",
      });
    }

    // Remove from their previous class's roster, if any
    if (student.class && student.class.toString() !== id) {
      await Class.updateOne(
        { _id: student.class },
        { $pull: { students: student._id } }
      );
    }

    classData.students.push(studentId);
    student.class = classData._id;

    await classData.save();
    await student.save();

    await classData.populate("teacher", "name email role");
    await classData.populate(studentPopulate);

    res.status(200).json({
      success: true,
      message: "Student added to class successfully",
      data: classData,
    });

  } catch (error) {
    console.log("Add student to class error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Remove Student from Class
// Admin Only
// ========================================

export const removeStudentFromClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid class id",
      });
    }

    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Valid studentId is required",
      });
    }

    const classData = await Class.findById(id);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    const isInClass = classData.students.some(
      (s) => s.toString() === studentId
    );

    if (!isInClass) {
      return res.status(400).json({
        success: false,
        message: "Student is not in this class",
      });
    }

    classData.students = classData.students.filter(
      (s) => s.toString() !== studentId
    );

    await classData.save();

    // Unassign class from student only if it still points here
    await Student.updateOne(
      { _id: studentId, class: id },
      { class: null }
    );

    await classData.populate("teacher", "name email role");
    await classData.populate(studentPopulate);

    res.status(200).json({
      success: true,
      message: "Student removed from class successfully",
      data: classData,
    });

  } catch (error) {
    console.log("Remove student from class error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
