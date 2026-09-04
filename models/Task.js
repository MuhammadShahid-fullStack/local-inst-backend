import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    // Task belongs to one Class. All students
    // in that class can see/submit it.
    assignedClass: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },

    // Teacher (or admin) who created the task
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    deadline: {
      type: Date,
      required: true,
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },

    // Task-level lifecycle. Per-student progress
    // lives in the Submission model, not here.
    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

const Task = mongoose.model("Task", taskSchema);

export default Task;
