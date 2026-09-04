import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    // ========================================
    // Student
    // ========================================

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    // ========================================
    // Attendance Date
    // ========================================

    date: {
      type: Date,
      required: true,
    },

    // ========================================
    // Attendance Status
    // ========================================

    status: {
      type: String,
      enum: ["Present", "Absent", "Late"],
      required: true,
    },

    // ========================================
    // Teacher Remarks
    // ========================================

    remarks: {
      type: String,
      trim: true,
      default: "",
    },

    // ========================================
    // Teacher who marked attendance
    // (for self check-in/check-out, this is
    // the student's own user id)
    // ========================================

    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ========================================
    // Student self check-in / check-out times
    // ========================================

    checkInTime: {
      type: Date,
      default: null,
    },

    checkOutTime: {
      type: Date,
      default: null,
    },

    // ========================================
    // GPS Attendance - Audit Fields
    // Optional. Only populated for a GPS-verified
    // self check-in; manually marked attendance
    // (admin/teacher) never sets these.
    // ========================================

    location: {
      latitude: {
        type: Number,
        min: -90,
        max: 90,
      },

      longitude: {
        type: Number,
        min: -180,
        max: 180,
      },
    },

    // meters, computed server-side from the class's
    // configured location - never trust a distance
    // value from the client
    distanceFromClass: {
      type: Number,
      min: 0,
    },

    verifiedByGps: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);


// ========================================
// Prevent duplicate attendance
// for same student + same date
// ========================================

attendanceSchema.index(
  {
    student: 1,
    date: 1,
  },
  {
    unique: true,
  }
);


const Attendance = mongoose.model(
  "Attendance",
  attendanceSchema
);

export default Attendance;