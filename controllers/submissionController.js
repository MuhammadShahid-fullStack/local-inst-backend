import mongoose from "mongoose";

import Submission from "../models/Submission.js";
import Task from "../models/Task.js";
import Student from "../models/Student.js";


// =====================================================
// Submit Task
// Student Only (self)
// =====================================================

export const submitTask = async (req, res) => {
  try {
    const { task: taskId, answer } = req.body;

    if (!taskId || !answer) {
      return res.status(400).json({
        success: false,
        message: "Task and answer are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task id",
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

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Task must belong to the student's own class
    if (
      !student.class ||
      student.class.toString() !== task.assignedClass.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "This task is not assigned to your class",
      });
    }

    const existing = await Submission.findOne({
      task: taskId,
      student: student._id,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "You have already submitted this task",
      });
    }

    const isLate = new Date() > new Date(task.deadline);

    const submission = await Submission.create({
      task: taskId,
      student: student._id,
      answer,
      status: isLate ? "late" : "submitted",
    });

    await submission.populate("task", "title description deadline");

    res.status(201).json({
      success: true,
      message: isLate
        ? "Task submitted (after deadline)"
        : "Task submitted successfully",
      data: submission,
    });

  } catch (error) {
    // Handles a race where two requests pass the duplicate
    // check at the same time; the unique index catches it here.
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "You have already submitted this task",
      });
    }

    console.log("Submit task error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// =====================================================
// Get My Submissions
// Student Only (self)
// =====================================================

export const getMySubmissions = async (req, res) => {
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

    const submissions = await Submission.find({
      student: student._id,
    })
      .populate("task", "title description deadline priority status")
      .sort({ submittedAt: -1 });

    res.status(200).json({
      success: true,
      count: submissions.length,
      data: submissions,
    });

  } catch (error) {
    console.log("Get my submissions error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// =====================================================
// Update Submission
// Student Only (own submission)
//
// Only the answer can be changed here. student/task/
// marks/teacherFeedback are never read from the body.
// =====================================================

export const updateSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { answer } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission id",
      });
    }

    if (!answer) {
      return res.status(400).json({
        success: false,
        message: "Answer is required",
      });
    }

    const submission = await Submission.findById(id).populate(
      "task",
      "deadline"
    );

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    const student = await Student.findOne({
      user: req.user.userId,
    });

    if (
      !student ||
      submission.student.toString() !== student._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update this submission",
      });
    }

    if (new Date() > new Date(submission.task.deadline)) {
      return res.status(400).json({
        success: false,
        message: "Deadline has passed, submission can no longer be updated",
      });
    }

    submission.answer = answer;

    await submission.save();

    await submission.populate("task", "title description deadline");

    res.status(200).json({
      success: true,
      message: "Submission updated successfully",
      data: submission,
    });

  } catch (error) {
    console.log("Update submission error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// =====================================================
// Get Submissions For A Task
// Admin (any task) / Teacher (own class only)
// =====================================================

export const getTaskSubmissions = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task id",
      });
    }

    const task = await Task.findById(taskId).populate(
      "assignedClass",
      "className teacher"
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (
      req.user.role === "teacher" &&
      task.assignedClass.teacher.toString() !== req.user.userId
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only view submissions for your own class",
      });
    }

    const submissions = await Submission.find({
      task: taskId,
    })
      .populate({
        path: "student",
        select: "rollNumber",
        populate: {
          path: "user",
          select: "name email",
        },
      })
      .sort({ submittedAt: -1 });

    res.status(200).json({
      success: true,
      count: submissions.length,
      data: submissions,
    });

  } catch (error) {
    console.log("Get task submissions error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// =====================================================
// Give Marks
// Admin (any submission) / Teacher (own class only)
// =====================================================

export const giveMarks = async (req, res) => {
  try {
    const { id } = req.params;
    const { marks } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission id",
      });
    }

    if (
      marks === undefined ||
      marks === null ||
      typeof marks !== "number" ||
      marks < 0 ||
      marks > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Marks must be a number between 0 and 100",
      });
    }

    const submission = await Submission.findById(id).populate({
      path: "task",
      select: "assignedClass",
      populate: {
        path: "assignedClass",
        select: "teacher",
      },
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    if (
      req.user.role === "teacher" &&
      submission.task.assignedClass.teacher.toString() !== req.user.userId
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only grade submissions for your own class",
      });
    }

    submission.marks = marks;
    submission.status = "reviewed";

    await submission.save();

    res.status(200).json({
      success: true,
      message: "Marks updated successfully",
      data: submission,
    });

  } catch (error) {
    console.log("Give marks error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// =====================================================
// Add / Update Teacher Feedback
// Admin (any submission) / Teacher (own class only)
// =====================================================

export const addFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { teacherFeedback } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission id",
      });
    }

    if (!teacherFeedback) {
      return res.status(400).json({
        success: false,
        message: "Feedback is required",
      });
    }

    const submission = await Submission.findById(id).populate({
      path: "task",
      select: "assignedClass",
      populate: {
        path: "assignedClass",
        select: "teacher",
      },
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    if (
      req.user.role === "teacher" &&
      submission.task.assignedClass.teacher.toString() !== req.user.userId
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only give feedback for your own class",
      });
    }

    submission.teacherFeedback = teacherFeedback;
    submission.status = "reviewed";

    await submission.save();

    res.status(200).json({
      success: true,
      message: "Feedback updated successfully",
      data: submission,
    });

  } catch (error) {
    console.log("Add feedback error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
