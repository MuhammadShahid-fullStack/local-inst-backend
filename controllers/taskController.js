import mongoose from "mongoose";

import Task from "../models/Task.js";
import Class from "../models/Class.js";
import Student from "../models/Student.js";
import Submission from "../models/Submission.js";

const PRIORITIES = ["Low", "Medium", "High"];
const STATUSES = ["active", "closed"];


// =====================================================
// Create Task
// Admin (any class) / Teacher (own class only)
// =====================================================

export const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      assignedClass,
      deadline,
      priority,
    } = req.body;

    if (!title || !description || !assignedClass || !deadline) {
      return res.status(400).json({
        success: false,
        message:
          "Title, description, assigned class and deadline are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(assignedClass)) {
      return res.status(400).json({
        success: false,
        message: "Invalid class id",
      });
    }

    if (priority && !PRIORITIES.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: "Invalid priority",
      });
    }

    const classDoc = await Class.findById(assignedClass);

    if (!classDoc) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // Teacher can only create tasks for a class they teach
    if (
      req.user.role === "teacher" &&
      classDoc.teacher.toString() !== req.user.userId
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only create tasks for your own class",
      });
    }

    const task = await Task.create({
      title,
      description,
      assignedClass,
      assignedBy: req.user.userId,
      deadline,
      priority: priority || "Medium",
    });

    await task.populate("assignedClass", "className schedule room status");
    await task.populate("assignedBy", "name email role");

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: task,
    });

  } catch (error) {
    console.log("Create task error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// =====================================================
// Get All Tasks
// Admin (every task) / Teacher (tasks they created)
// =====================================================

export const getAllTasks = async (req, res) => {
  try {
    const filter = {};

    if (req.user.role === "teacher") {
      filter.assignedBy = req.user.userId;
    }

    const tasks = await Task.find(filter)
      .populate("assignedClass", "className schedule room status")
      .populate("assignedBy", "name email role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks,
    });

  } catch (error) {
    console.log("Get all tasks error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// =====================================================
// Get My Tasks
// Teacher - tasks across ALL of their assigned classes
// Student - only tasks assigned to their own class,
// with their own submission status attached
// =====================================================

export const getMyTasks = async (req, res) => {
  try {
    if (req.user.role === "teacher") {
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

      const tasks = await Task.find({
        assignedClass: { $in: classIds },
      })
        .populate("assignedClass", "className schedule room status")
        .populate("assignedBy", "name email role")
        .sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        count: tasks.length,
        data: tasks,
      });
    }

    const student = await Student.findOne({
      user: req.user.userId,
    }).populate("class", "className");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    if (!student.class) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    const tasks = await Task.find({
      assignedClass: student.class._id,
    })
      .populate("assignedBy", "name email role")
      .sort({ deadline: 1 });

    const submissions = await Submission.find({
      task: { $in: tasks.map((task) => task._id) },
      student: student._id,
    });

    const submissionByTask = {};

    submissions.forEach((submission) => {
      submissionByTask[submission.task.toString()] = submission;
    });

    const data = tasks.map((task) => {
      const submission = submissionByTask[task._id.toString()];

      return {
        _id: task._id,
        title: task.title,
        description: task.description,
        deadline: task.deadline,
        priority: task.priority,
        status: task.status,
        assignedBy: task.assignedBy,
        assignedClass: student.class,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,

        mySubmission: submission
          ? {
              id: submission._id,
              status: submission.status,
              submittedAt: submission.submittedAt,
              marks: submission.marks,
              teacherFeedback: submission.teacherFeedback,
            }
          : null,
      };
    });

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });

  } catch (error) {
    console.log("Get my tasks error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// =====================================================
// Get Single Task
// Admin (any task)
// Teacher (only if task belongs to one of their classes)
// Student (only if task belongs to their own class)
// =====================================================

export const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task id",
      });
    }

    const task = await Task.findById(id)
      .populate("assignedClass", "className schedule room status teacher")
      .populate("assignedBy", "name email role");

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (req.user.role === "student") {
      const student = await Student.findOne({
        user: req.user.userId,
      });

      if (
        !student ||
        !student.class ||
        student.class.toString() !== task.assignedClass._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to view this task",
        });
      }
    }

    if (
      req.user.role === "teacher" &&
      task.assignedClass.teacher.toString() !== req.user.userId
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this task",
      });
    }

    res.status(200).json({
      success: true,
      data: task,
    });

  } catch (error) {
    console.log("Get task error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// =====================================================
// Update Task
// Admin (any task) / Teacher (own tasks only)
// =====================================================

export const updateTask = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task id",
      });
    }

    const task = await Task.findById(id).populate("assignedClass", "teacher");

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // "Own tasks" for a teacher means tasks for a class they teach -
    // same rule createTask uses - not just tasks they personally
    // created, otherwise a teacher could never manage a task an
    // admin assigned to the teacher's own class.
    if (
      req.user.role === "teacher" &&
      task.assignedClass.teacher.toString() !== req.user.userId
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only update tasks for your own class",
      });
    }

    const {
      title,
      description,
      deadline,
      priority,
      status,
      assignedClass,
    } = req.body;

    if (assignedClass !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(assignedClass)) {
        return res.status(400).json({
          success: false,
          message: "Invalid class id",
        });
      }

      const classDoc = await Class.findById(assignedClass);

      if (!classDoc) {
        return res.status(404).json({
          success: false,
          message: "Class not found",
        });
      }

      if (
        req.user.role === "teacher" &&
        classDoc.teacher.toString() !== req.user.userId
      ) {
        return res.status(403).json({
          success: false,
          message: "You can only assign tasks to your own class",
        });
      }

      task.assignedClass = assignedClass;
    }

    if (priority !== undefined) {
      if (!PRIORITIES.includes(priority)) {
        return res.status(400).json({
          success: false,
          message: "Invalid priority",
        });
      }

      task.priority = priority;
    }

    if (status !== undefined) {
      if (!STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status",
        });
      }

      task.status = status;
    }

    if (title !== undefined) {
      task.title = title;
    }

    if (description !== undefined) {
      task.description = description;
    }

    if (deadline !== undefined) {
      task.deadline = deadline;
    }

    await task.save();

    await task.populate("assignedClass", "className schedule room status");
    await task.populate("assignedBy", "name email role");

    res.status(200).json({
      success: true,
      message: "Task updated successfully",
      data: task,
    });

  } catch (error) {
    console.log("Update task error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// =====================================================
// Delete Task
// Admin (any task) / Teacher (own tasks only)
// =====================================================

export const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task id",
      });
    }

    const task = await Task.findById(id).populate("assignedClass", "teacher");

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Same class-ownership rule as updateTask/createTask.
    if (
      req.user.role === "teacher" &&
      task.assignedClass.teacher.toString() !== req.user.userId
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only delete tasks for your own class",
      });
    }

    await Task.findByIdAndDelete(id);

    // Remove submissions tied to this task so none are orphaned
    await Submission.deleteMany({ task: id });

    res.status(200).json({
      success: true,
      message: "Task deleted successfully",
    });

  } catch (error) {
    console.log("Delete task error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
