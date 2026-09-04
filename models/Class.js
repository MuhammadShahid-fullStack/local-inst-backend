import mongoose from "mongoose";

const classSchema = new mongoose.Schema(
  {
    className: {
      type: String,
      required: true,
      trim: true,
    },

    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
      },
    ],

    schedule: {
      type: String,
      required: true,
      trim: true,
    },

    room: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    // ========================================
    // GPS Attendance - Class Location
    // Optional. A class with no location configured
    // is simply not eligible for GPS attendance.
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

      radius: {
        // meters
        type: Number,
        min: 1,
        max: 5000,
      },
    },

    // ========================================
    // GPS Attendance - Time Window
    // Optional. startTime/endTime are "HH:MM" in
    // 24-hour format (time-of-day, not a Date) so
    // comparisons stay in local time and never risk
    // the UTC "YYYY-MM-DD" parsing bug.
    // ========================================

    attendanceWindow: {
      startTime: {
        type: String,
        match: [
          /^([01]\d|2[0-3]):([0-5]\d)$/,
          "startTime must be in HH:MM 24-hour format",
        ],
      },

      endTime: {
        type: String,
        match: [
          /^([01]\d|2[0-3]):([0-5]\d)$/,
          "endTime must be in HH:MM 24-hour format",
        ],
      },

      days: [
        {
          type: String,
          enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

// ========================================
// If a location is configured, latitude,
// longitude and radius must all be provided
// together - a partial location is meaningless.
// ========================================

classSchema.pre("validate", function () {
  if (this.location) {
    const { latitude, longitude, radius } = this.location;

    const providedCount = [latitude, longitude, radius].filter(
      (value) => value !== undefined && value !== null
    ).length;

    if (providedCount > 0 && providedCount < 3) {
      throw new Error(
        "latitude, longitude and radius must all be provided together"
      );
    }
  }
});

const Class = mongoose.model("Class", classSchema);

export default Class;
