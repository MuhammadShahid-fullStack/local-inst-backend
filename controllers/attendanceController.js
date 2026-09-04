import mongoose from "mongoose";

import Attendance from "../models/Attendance.js";
import Student from "../models/Student.js";
import User from "../models/User.js";
import Class from "../models/Class.js";
import { getDistanceInMeters } from "../utils/distance.js";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ========================================
// Helper: today's date at midnight
// (matches the student+date unique index)
// ========================================

const getStartOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};


// ========================================
// Helper: parse "YYYY-MM-DD" as a LOCAL
// calendar date, not UTC.
//
// new Date("YYYY-MM-DD") parses as UTC
// midnight, which does not match the local
// midnight used by check-in/check-out and
// silently misses "today". Returns null on
// an invalid string.
// ========================================

const parseLocalDate = (dateString) => {
  const parts = dateString.split("-").map(Number);

  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  const [year, month, day] = parts;
  const parsed = new Date(year, month - 1, day);

  return isNaN(parsed.getTime()) ? null : parsed;
};


// ========================================
// Check In
// Student Only (self)
// ========================================

export const checkIn = async (req, res) => {
  try {
    const student = await Student.findOne({
      user: req.user.userId,
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    const today = getStartOfToday();

    const existing = await Attendance.findOne({
      student: student._id,
      date: today,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "You have already checked in today",
      });
    }

    const attendance = await Attendance.create({
      student: student._id,
      date: today,
      status: "Present",
      checkInTime: new Date(),
      markedBy: req.user.userId,
    });

    res.status(201).json({
      success: true,
      message: "Checked in successfully",
      attendance,
    });

  } catch (error) {
    console.log("Check in error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Check Out
// Student Only (self)
// ========================================

export const checkOut = async (req, res) => {
  try {
    const student = await Student.findOne({
      user: req.user.userId,
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    const today = getStartOfToday();

    const attendance = await Attendance.findOne({
      student: student._id,
      date: today,
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Please check in first",
      });
    }

    if (attendance.checkOutTime) {
      return res.status(400).json({
        success: false,
        message: "You have already checked out today",
      });
    }

    attendance.checkOutTime = new Date();

    await attendance.save();

    res.status(200).json({
      success: true,
      message: "Checked out successfully",
      attendance,
    });

  } catch (error) {
    console.log("Check out error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Mark Attendance By GPS
// Student Only (self)
//
// A separate endpoint from checkIn - checkIn stays
// untouched so classes that haven't configured GPS
// attendance keep working exactly as before. This
// path only works for a class that has both
// location and attendanceWindow configured.
//
// The backend is the sole authority here: identity
// (from the JWT), current time, attendance date,
// the window check and the distance check are all
// computed server-side. Only the raw coordinates
// come from the client.
// ========================================

export const markAttendanceByGps = async (req, res) => {
  try {
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({
        success: false,
        message: "Valid latitude and longitude are required",
      });
    }

    if (latitude < -90 || latitude > 90) {
      return res.status(400).json({
        success: false,
        message: "Invalid latitude",
      });
    }

    if (longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: "Invalid longitude",
      });
    }

    const student = await Student.findOne({
      user: req.user.userId,
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

    const studentClass = await Class.findById(student.class);

    if (!studentClass) {
      return res.status(404).json({
        success: false,
        message: "Assigned class not found",
      });
    }

    // Location must be fully configured - an unset nested path reads
    // back as {} (not undefined), so check an actual value, not
    // truthiness of the container object.
    const { location } = studentClass;

    if (
      !location ||
      location.latitude === undefined ||
      location.longitude === undefined ||
      location.radius === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "GPS attendance is not configured for your class",
      });
    }

    const { attendanceWindow } = studentClass;

    if (
      !attendanceWindow ||
      !attendanceWindow.startTime ||
      !attendanceWindow.endTime ||
      !attendanceWindow.days ||
      attendanceWindow.days.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Attendance window is not configured for your class",
      });
    }

    // Weekday + time window - both from server-local time only
    const now = new Date();
    const today = WEEKDAYS[now.getDay()];

    if (!attendanceWindow.days.includes(today)) {
      return res.status(400).json({
        success: false,
        message: "Attendance is not open today",
      });
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMinute] = attendanceWindow.startTime
      .split(":")
      .map(Number);
    const [endHour, endMinute] = attendanceWindow.endTime
      .split(":")
      .map(Number);

    const windowStartMinutes = startHour * 60 + startMinute;
    const windowEndMinutes = endHour * 60 + endMinute;

    if (currentMinutes < windowStartMinutes) {
      return res.status(400).json({
        success: false,
        message: "Attendance window has not opened yet",
      });
    }

    if (currentMinutes > windowEndMinutes) {
      return res.status(400).json({
        success: false,
        message: "Attendance window has closed",
      });
    }

    // Distance - always computed server-side
    const distance = getDistanceInMeters(
      latitude,
      longitude,
      location.latitude,
      location.longitude
    );

    if (distance > location.radius) {
      return res.status(403).json({
        success: false,
        message: "You are outside the allowed attendance radius",
      });
    }

    // Same local-midnight convention as checkIn/checkOut
    const todayDate = getStartOfToday();

    const existing = await Attendance.findOne({
      student: student._id,
      date: todayDate,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Attendance already marked for today",
      });
    }

    const attendance = await Attendance.create({
      student: student._id,
      date: todayDate,
      status: "Present",
      checkInTime: new Date(),
      markedBy: req.user.userId,
      location: { latitude, longitude },
      distanceFromClass: distance,
      verifiedByGps: true,
    });

    res.status(201).json({
      success: true,
      message: "Attendance marked successfully",
      attendance,
    });

  } catch (error) {
    // The findOne check above is a fast path, not the real guarantee -
    // the {student,date} unique index is. A duplicate key error here
    // means a race between two near-simultaneous requests.
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Attendance already marked for today",
      });
    }

    console.log("GPS attendance error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Mark Attendance
// Admin (any student) / Teacher (own class students only)
// ========================================

export const markAttendance = async (req, res) => {
  try {
    const {
      studentId,
      date,
      status,
      remarks,
    } = req.body;

    // Required fields
    if (!studentId || !date || !status) {
      return res.status(400).json({
        success: false,
        message:
          "Student, date and attendance status are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student id",
      });
    }

    // Validate status
    const allowedStatus = [
      "Present",
      "Absent",
      "Late",
    ];

    if (!allowedStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid attendance status",
      });
    }

    // Same local-midnight convention as checkIn/checkOut/GPS marking -
    // new Date(date) would parse as UTC midnight and silently create a
    // second record for what is the same calendar day locally.
    const attendanceDate = parseLocalDate(date);

    if (!attendanceDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format",
      });
    }

    // Check student
    const student = await Student.findById(studentId)
      .populate("user", "name email role")
      .populate("class", "teacher");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Teacher may only mark attendance for students in their own classes
    if (
      req.user.role === "teacher" &&
      (!student.class || student.class.teacher.toString() !== req.user.userId)
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only mark attendance for students in your own classes",
      });
    }

    // Check duplicate attendance
    const existingAttendance =
      await Attendance.findOne({
        student: studentId,
        date: attendanceDate,
      });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message:
          "Attendance already marked for this student on this date",
      });
    }

    // Create attendance
    const attendance = await Attendance.create({
      student: studentId,
      date: attendanceDate,
      status,
      remarks: remarks || "",
      markedBy: req.user.userId,
    });

    // Populate data
    await attendance.populate([
      {
        path: "student",
        populate: {
          path: "user",
          select: "name email role",
        },
      },
      {
        path: "markedBy",
        select: "name email role",
      },
    ]);

    res.status(201).json({
      success: true,
      message:
        "Attendance marked successfully",
      attendance,
    });

  } catch (error) {
    console.log(
      "Mark attendance error:",
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
// Get All Attendance
// Admin Only
// (Teacher uses /my-classes instead, scoped
// to their own classes)
// ========================================

export const getAllAttendance = async (
  req,
  res
) => {
  try {
    const attendance = await Attendance.find()
      .populate({
        path: "student",
        populate: {
          path: "user",
          select: "name email role",
        },
      })
      .populate(
        "markedBy",
        "name email role"
      )
      .sort({
        date: -1,
        createdAt: -1,
      });

    res.status(200).json({
      success: true,
      count: attendance.length,
      attendance,
    });

  } catch (error) {
    console.log(
      "Get all attendance error:",
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
// Get My Attendance
// Student
// ========================================

export const getMyAttendance = async (
  req,
  res
) => {
  try {
    // Logged-in user's ID
    const userId = req.user.userId;

    // Optional ?date=YYYY-MM-DD filter
    const { date } = req.query;

    // Find student profile
    const student = await Student.findOne({
      user: userId,
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message:
          "Student profile not found",
      });
    }

    const filter = {
      student: student._id,
    };

    if (date) {
      const requestedDate = parseLocalDate(date);

      if (!requestedDate) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format",
        });
      }

      filter.date = requestedDate;
    }

    // Get attendance
    const attendance =
      await Attendance.find(filter)
        .populate(
          "markedBy",
          "name email role"
        )
        .sort({
          date: -1,
        });

    // Statistics
    const total = attendance.length;

    const present = attendance.filter(
      (item) =>
        item.status === "Present"
    ).length;

    const absent = attendance.filter(
      (item) =>
        item.status === "Absent"
    ).length;

    const late = attendance.filter(
      (item) =>
        item.status === "Late"
    ).length;

    const percentage =
      total > 0
        ? Math.round(
            ((present + late) / total) *
              100
          )
        : 0;

    res.status(200).json({
      success: true,
      count: attendance.length,

      statistics: {
        total,
        present,
        absent,
        late,
        percentage,
      },

      attendance,
    });

  } catch (error) {
    console.log(
      "Get my attendance error:",
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
// Get Attendance By Student
// Admin (any student) / Teacher (own class students only)
// ========================================

export const getAttendanceByStudent = async (
  req,
  res
) => {
  try {
    const { studentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student id",
      });
    }

    const student =
      await Student.findById(studentId)
        .populate(
          "user",
          "name email role"
        )
        .populate("class", "className teacher");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    if (
      req.user.role === "teacher" &&
      (!student.class || student.class.teacher.toString() !== req.user.userId)
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view this student's attendance",
      });
    }

    const attendance =
      await Attendance.find({
        student: studentId,
      })
        .populate(
          "markedBy",
          "name email role"
        )
        .sort({
          date: -1,
        });

    const total = attendance.length;

    const present = attendance.filter(
      (item) =>
        item.status === "Present"
    ).length;

    const absent = attendance.filter(
      (item) =>
        item.status === "Absent"
    ).length;

    const late = attendance.filter(
      (item) =>
        item.status === "Late"
    ).length;

    const percentage =
      total > 0
        ? Math.round(
            ((present + late) / total) *
              100
          )
        : 0;

    res.status(200).json({
      success: true,

      student,

      statistics: {
        total,
        present,
        absent,
        late,
        percentage,
      },

      attendance,
    });

  } catch (error) {
    console.log(
      "Get student attendance error:",
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
// Get My Classes' Attendance
// Teacher Only - attendance for students in
// ALL of the logged-in teacher's assigned
// classes. Supports optional ?date=YYYY-MM-DD
// ========================================

export const getMyClassesAttendance = async (
  req,
  res
) => {
  try {
    const { date } = req.query;

    const myClasses = await Class.find(
      { teacher: req.user.userId },
      "_id"
    );

    const classIds = myClasses.map((c) => c._id);

    if (classIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        attendance: [],
      });
    }

    const myStudents = await Student.find(
      { class: { $in: classIds } },
      "_id"
    );

    const studentIds = myStudents.map((s) => s._id);

    if (studentIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        attendance: [],
      });
    }

    const filter = {
      student: { $in: studentIds },
    };

    if (date) {
      const requestedDate = parseLocalDate(date);

      if (!requestedDate) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format",
        });
      }

      filter.date = requestedDate;
    }

    const attendance = await Attendance.find(filter)
      .populate({
        path: "student",
        select: "rollNumber class",
        populate: [
          { path: "user", select: "name email" },
          { path: "class", select: "className" },
        ],
      })
      .populate("markedBy", "name email role")
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: attendance.length,
      attendance,
    });

  } catch (error) {
    console.log(
      "Get my classes attendance error:",
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
// Get Class Attendance Summary
// Admin (any class) / Teacher (own class only)
// Supports optional ?date=YYYY-MM-DD
// ========================================

export const getClassAttendance = async (
  req,
  res
) => {
  try {
    const { classId } = req.params;
    const { date } = req.query;

    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid class id",
      });
    }

    const classData = await Class.findById(classId);

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    if (
      req.user.role === "teacher" &&
      classData.teacher.toString() !== req.user.userId
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view attendance for this class",
      });
    }

    const students = await Student.find(
      { class: classId },
      "_id"
    );

    const studentIds = students.map((s) => s._id);

    const filter = {
      student: { $in: studentIds },
    };

    if (date) {
      const requestedDate = parseLocalDate(date);

      if (!requestedDate) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format",
        });
      }

      filter.date = requestedDate;
    }

    const attendance =
      studentIds.length > 0
        ? await Attendance.find(filter)
            .populate({
              path: "student",
              select: "rollNumber",
              populate: { path: "user", select: "name email" },
            })
            .sort({ date: -1 })
        : [];

    const total = attendance.length;

    const present = attendance.filter(
      (item) => item.status === "Present"
    ).length;

    const absent = attendance.filter(
      (item) => item.status === "Absent"
    ).length;

    const late = attendance.filter(
      (item) => item.status === "Late"
    ).length;

    const percentage =
      total > 0
        ? Math.round(((present + late) / total) * 100)
        : 0;

    res.status(200).json({
      success: true,

      totalStudents: studentIds.length,

      statistics: {
        total,
        present,
        absent,
        late,
        percentage,
      },

      attendance,
    });

  } catch (error) {
    console.log(
      "Get class attendance error:",
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
// Update Attendance
// Admin (any record) / Teacher (own class students only)
// ========================================

export const updateAttendance = async (
  req,
  res
) => {
  try {
    const attendanceId =
      req.params.id;

    if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance id",
      });
    }

    const {
      date,
      status,
      remarks,
    } = req.body;

    const attendance =
      await Attendance.findById(attendanceId)
        .populate({
          path: "student",
          select: "class",
          populate: { path: "class", select: "teacher" },
        });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message:
          "Attendance record not found",
      });
    }

    if (
      req.user.role === "teacher" &&
      (!attendance.student.class ||
        attendance.student.class.teacher.toString() !== req.user.userId)
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only update attendance for students in your own classes",
      });
    }

    // Validate status
    if (status) {
      const allowedStatus = [
        "Present",
        "Absent",
        "Late",
      ];

      if (
        !allowedStatus.includes(status)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid attendance status",
        });
      }

      attendance.status = status;
    }

    if (date !== undefined) {
      const parsedDate = parseLocalDate(date);

      if (!parsedDate) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format",
        });
      }

      attendance.date = parsedDate;
    }

    if (remarks !== undefined) {
      attendance.remarks = remarks;
    }

    await attendance.save();

    await attendance.populate([
      {
        path: "student",
        populate: {
          path: "user",
          select: "name email role",
        },
      },
      {
        path: "markedBy",
        select: "name email role",
      },
    ]);

    res.status(200).json({
      success: true,
      message:
        "Attendance updated successfully",
      attendance,
    });

  } catch (error) {
    console.log(
      "Update attendance error:",
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
// Delete Attendance
// Admin Only
// ========================================

export const deleteAttendance = async (
  req,
  res
) => {
  try {
    const attendanceId =
      req.params.id;

    if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance id",
      });
    }

    const attendance =
      await Attendance.findById(
        attendanceId
      );

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message:
          "Attendance record not found",
      });
    }

    await Attendance.findByIdAndDelete(
      attendanceId
    );

    res.status(200).json({
      success: true,
      message:
        "Attendance deleted successfully",
    });

  } catch (error) {
    console.log(
      "Delete attendance error:",
      error.message
    );

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
