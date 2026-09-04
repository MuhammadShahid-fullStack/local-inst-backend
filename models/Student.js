import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    rollNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    phone: {
      type: String,
      default: "",
      trim: true,
    },

    // Student ki actual Class
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      default: null,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

const Student = mongoose.model("Student", studentSchema);

export default Student;