import mongoose from "mongoose";
import Leave from "../models/Leave.js";
import Student from "../models/Student.js";
import User from "../models/User.js";
import { sendEmail } from "../utils/sendEmail.js";

const getLoggedInUserId = (req) =>
  req.user?.userId || req.user?._id || req.user?.id;

const getLoggedInRole = (req) => req.user?.role?.toLowerCase();

const populateLeave = (query) =>
  query
    .populate({
      path: "student",
      populate: {
        path: "user",
        select: "name email",
      },
    })
    .populate("teacher", "name email");

export const getTeachersForLeave = async (req, res) => {
  try {
    if (getLoggedInRole(req) !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can view teachers for leave requests",
      });
    }

    const teachers = await User.find({ role: "teacher" })
      .select("name email")
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      teachers,
      data: teachers,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to load teachers",
      error: error.message,
    });
  }
};

export const createLeaveRequest = async (req, res) => {
  try {
    if (getLoggedInRole(req) !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can create leave requests",
      });
    }

    const { teacher, leaveType, reason, fromDate, toDate } = req.body;
    const userId = getLoggedInUserId(req);

    if (!teacher || !reason || !fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: "Teacher, reason, from date and to date are required",
      });
    }

    if (!mongoose.isValidObjectId(teacher)) {
      return res.status(400).json({
        success: false,
        message: "Invalid teacher selected",
      });
    }

    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid leave date",
      });
    }

    if (endDate < startDate) {
      return res.status(400).json({
        success: false,
        message: "To date cannot be before from date",
      });
    }

    // JWT uses userId, not req.user.id.
    const student = await Student.findOne({ user: userId });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    const teacherUser = await User.findOne({
      _id: teacher,
      role: "teacher",
    });

    if (!teacherUser) {
      return res.status(404).json({
        success: false,
        message: "Selected teacher not found",
      });
    }

    const leave = await Leave.create({
      student: student._id,
      teacher: teacherUser._id,
      leaveType: leaveType || "Sick",
      reason,
      fromDate: startDate,
      toDate: endDate,
      status: "pending",
    });

    const populatedLeave = await populateLeave(Leave.findById(leave._id));

    try {
  await sendEmail({
    to: teacherUser.email,
    subject: "New Leave Request Received",
    html: `
      <h2>New Leave Request</h2>
      <p>A student has sent you a leave request.</p>
      <p><strong>Student:</strong> ${populatedLeave.student?.user?.name || "Student"}</p>
      <p><strong>Leave type:</strong> ${populatedLeave.leaveType}</p>
      <p><strong>From:</strong> ${new Date(populatedLeave.fromDate).toLocaleDateString()}</p>
      <p><strong>To:</strong> ${new Date(populatedLeave.toDate).toLocaleDateString()}</p>
      <p><strong>Reason:</strong> ${populatedLeave.reason}</p>
    `,
  });
} catch (emailError) {
  console.error("Leave email failed:", emailError.message);
}

    return res.status(201).json({
      success: true,
      message: "Leave request submitted successfully",
      leave: populatedLeave,
      data: populatedLeave,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to create leave request",
      error: error.message,
    });
  }
};

export const getMyLeaveRequests = async (req, res) => {
  try {
    if (getLoggedInRole(req) !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can view their leave requests",
      });
    }

    const student = await Student.findOne({
      user: getLoggedInUserId(req),
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    const leaves = await Leave.find({ student: student._id })
      .populate("teacher", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: leaves.length,
      leaves,
      data: leaves,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to load leave requests",
      error: error.message,
    });
  }
};

export const getTeacherLeaveRequests = async (req, res) => {
  try {
    if (getLoggedInRole(req) !== "teacher") {
      return res.status(403).json({
        success: false,
        message: "Only teachers can view leave requests",
      });
    }

    const leaves = await populateLeave(
      Leave.find({ teacher: getLoggedInUserId(req) }).sort({ createdAt: -1 })
    );

    return res.status(200).json({
      success: true,
      count: leaves.length,
      leaves,
      data: leaves,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to load leave requests",
      error: error.message,
    });
  }
};

export const updateLeaveStatus = async (req, res) => {
  try {
    if (getLoggedInRole(req) !== "teacher") {
      return res.status(403).json({
        success: false,
        message: "Only teachers can update leave status",
      });
    }

    const { id } = req.params;
    const { status, teacherComment = "" } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid leave request ID",
      });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be approved or rejected",
      });
    }

    const leave = await Leave.findOne({
      _id: id,
      teacher: getLoggedInUserId(req),
    });

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found",
      });
    }

    leave.status = status;
    leave.teacherComment = teacherComment;
    await leave.save();

    const updatedLeave = await populateLeave(Leave.findById(leave._id));

    return res.status(200).json({
      success: true,
      message: `Leave request ${status} successfully`,
      leave: updatedLeave,
      data: updatedLeave,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to update leave request",
      error: error.message,
    });
  }
};