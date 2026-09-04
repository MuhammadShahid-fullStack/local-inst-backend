import Student from "../models/Student.js";
import Attendance from "../models/Attendance.js";
import Task from "../models/Task.js";
import Submission from "../models/Submission.js";


// ========================================
// Student Dashboard
// Student Only (self)
// ========================================

export const getStudentDashboard = async (req, res) => {
  try {
    const student = await Student.findOne({
      user: req.user.userId,
    })
      .populate("user", "name email role")
      .populate({
        path: "class",
        select: "className teacher schedule room status",
        populate: {
          path: "teacher",
          select: "name email role",
        },
      });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    // Independent queries, run together
    const [attendanceRecords, tasks, submissions] = await Promise.all([
      Attendance.find({ student: student._id }),

      student.class
        ? Task.find({ assignedClass: student.class._id })
            .populate("assignedBy", "name email role")
            .sort({ createdAt: -1 })
        : Promise.resolve([]),

      Submission.find({ student: student._id })
        .populate("task", "title description deadline")
        .sort({ submittedAt: -1 }),
    ]);


    // ========================================
    // Attendance Summary
    // ========================================

    const totalAttendance = attendanceRecords.length;

    const presentCount = attendanceRecords.filter(
      (a) => a.status === "Present"
    ).length;

    const absentCount = attendanceRecords.filter(
      (a) => a.status === "Absent"
    ).length;

    const lateCount = attendanceRecords.filter(
      (a) => a.status === "Late"
    ).length;

    const attendancePercentage =
      totalAttendance > 0
        ? Math.round(((presentCount + lateCount) / totalAttendance) * 100)
        : 0;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const todayAttendance =
      attendanceRecords.find((a) => {
        const recordDate = new Date(a.date);
        return recordDate >= startOfToday && recordDate < endOfToday;
      }) || null;


    // ========================================
    // Tasks + Submissions join
    // (class-scoped tasks already guaranteed by
    // the Task.find({ assignedClass }) query above)
    // ========================================

    const submissionByTask = {};

    submissions.forEach((submission) => {
      if (submission.task) {
        submissionByTask[submission.task._id.toString()] = submission;
      }
    });

    let pendingTasks = 0;
    let submittedTasks = 0;
    let reviewedTasks = 0;
    let overdueTasks = 0;

    const now = new Date();

    tasks.forEach((task) => {
      const submission = submissionByTask[task._id.toString()];

      if (!submission) {
        pendingTasks++;

        if (new Date(task.deadline) < now) {
          overdueTasks++;
        }
      } else if (submission.status === "reviewed") {
        reviewedTasks++;
      } else {
        submittedTasks++;
      }
    });

    const recentTasks = tasks.slice(0, 5).map((task) => {
      const submission = submissionByTask[task._id.toString()];

      return {
        id: task._id,
        title: task.title,
        deadline: task.deadline,
        priority: task.priority,
        assignedBy: task.assignedBy,
        mySubmissionStatus: submission ? submission.status : "pending",
      };
    });


    // ========================================
    // Submission Summary
    // ========================================

    const totalSubmissions = submissions.length;

    const reviewedSubmissions = submissions.filter(
      (s) => s.status === "reviewed"
    ).length;

    const pendingSubmissions = totalSubmissions - reviewedSubmissions;

    const gradedSubmissions = submissions.filter(
      (s) => typeof s.marks === "number"
    );

    const averageMarks =
      gradedSubmissions.length > 0
        ? Math.round(
            (gradedSubmissions.reduce((sum, s) => sum + s.marks, 0) /
              gradedSubmissions.length) *
              100
          ) / 100
        : null;

    const recentSubmissions = submissions.slice(0, 5).map((submission) => ({
      id: submission._id,
      taskTitle: submission.task?.title || null,
      submittedAt: submission.submittedAt,
      status: submission.status,
      marks: submission.marks,
      teacherFeedback: submission.teacherFeedback,
    }));


    // ========================================
    // Response
    // ========================================

    res.status(200).json({
      success: true,
      message: "Student dashboard fetched successfully",

      dashboard: {
        student: {
          name: student.user.name,
          email: student.user.email,
          phone: student.phone,
          rollNumber: student.rollNumber,
          status: student.status,
        },

        class: student.class || null,

        attendance: {
          total: totalAttendance,
          present: presentCount,
          absent: absentCount,
          late: lateCount,
          percentage: attendancePercentage,
          today: todayAttendance,
        },

        tasks: {
          total: tasks.length,
          pending: pendingTasks,
          submitted: submittedTasks,
          reviewed: reviewedTasks,
          overdue: overdueTasks,
        },

        submissions: {
          total: totalSubmissions,
          pending: pendingSubmissions,
          reviewed: reviewedSubmissions,
          averageMarks,
        },

        recentTasks,
        recentSubmissions,
      },
    });

  } catch (error) {
    console.log("Student dashboard error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
