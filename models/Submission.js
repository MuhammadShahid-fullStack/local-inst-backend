import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    answer: {
      type: String,
      required: true,
      trim: true,
    },

    submittedAt: {
      type: Date,
      default: Date.now,
    },

    // "submitted" on time, "late" if submitted after
    // the task deadline, "reviewed" once a teacher has
    // given marks and/or feedback
    status: {
      type: String,
      enum: ["submitted", "late", "reviewed"],
      default: "submitted",
    },

    marks: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },

    teacherFeedback: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);


// ========================================
// One submission per student per task
// ========================================

submissionSchema.index(
  {
    task: 1,
    student: 1,
  },
  {
    unique: true,
  }
);


const Submission = mongoose.model(
  "Submission",
  submissionSchema
);

export default Submission;
