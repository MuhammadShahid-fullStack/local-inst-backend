import User from "../models/User.js";
import Class from "../models/Class.js";
import Student from "../models/Student.js";
import Task from "../models/Task.js";
import Submission from "../models/Submission.js";
import Attendance from "../models/Attendance.js";

const getStartOfToday = () => {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return today;
};

const getEndOfToday = () => {
  const endOfToday = getStartOfToday();

  endOfToday.setDate(endOfToday.getDate() + 1);

  return endOfToday;
};

// ========================================
// Teacher Dashboard
// GET /api/teacher/dashboard
// ========================================
export const getTeacherDashboard = async (req, res) => {
  try {
    const teacherId = req.user.userId;

    const [teacher, classes] = await Promise.all([
      User.findById(teacherId, "name email role department"),

      Class.find({
        teacher: teacherId,
      })
        .select("className schedule room status location attendanceWindow students")
        .sort({ createdAt: -1 }),
    ]);

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher profile not found",
      });
    }

    const classIds = classes.map((item) => item._id);

    if (classIds.length === 0) {
      const data = {
        teacher: {
          name: teacher.name,
          email: teacher.email,
          department: teacher.department,
        },

        classes: {
          total: 0,
          list: [],
        },

        students: {
          total: 0,
        },

        tasks: {
          total: 0,
          active: 0,
          closed: 0,
        },

        submissions: {
          total: 0,
          pending: 0,
          reviewed: 0,
        },

        attendance: {
          today: {
            total: 0,
            present: 0,
            absent: 0,
            late: 0,
          },
        },

        recentTasks: [],
        recentSubmissions: [],
      };

      return res.status(200).json({
        success: true,
        message: "Teacher dashboard fetched successfully",
        data,
        dashboard: data,
      });
    }

    const [students, tasks] = await Promise.all([
      Student.find({
        class: {
          $in: classIds,
        },
      }).select("_id"),

      // Every task assigned to one of the teacher's classes - not just
      // ones they personally created, so an admin-created task for
      // their class still shows up here (matches taskController's
      // getMyTasks, which uses the same assignedClass-only filter).
      Task.find({
        assignedClass: {
          $in: classIds,
        },
      })
        .populate("assignedClass", "className")
        .sort({ createdAt: -1 }),
    ]);

    const studentIds = students.map((student) => student._id);
    const taskIds = tasks.map((task) => task._id);

    const [todayAttendance, submissions] = await Promise.all([
      studentIds.length > 0
        ? Attendance.find({
            student: {
              $in: studentIds,
            },

            date: {
              $gte: getStartOfToday(),
              $lt: getEndOfToday(),
            },
          })
        : Promise.resolve([]),

      taskIds.length > 0
        ? Submission.find({
            task: {
              $in: taskIds,
            },
          })
            .populate("task", "title")
            .populate({
              path: "student",
              select: "rollNumber",
              populate: {
                path: "user",
                select: "name",
              },
            })
            .sort({ submittedAt: -1 })
        : Promise.resolve([]),
    ]);

    const activeTasks = tasks.filter(
      (task) => task.status === "active"
    ).length;

    const closedTasks = tasks.filter(
      (task) => task.status === "closed"
    ).length;

    const reviewedSubmissions = submissions.filter(
      (submission) => submission.status === "reviewed"
    ).length;

    const pendingSubmissions =
      submissions.length - reviewedSubmissions;

    // Aapke Attendance controller ke hisaab se statuses capital letters mein hain.
    const presentToday = todayAttendance.filter(
      (attendance) => attendance.status === "Present"
    ).length;

    const absentToday = todayAttendance.filter(
      (attendance) => attendance.status === "Absent"
    ).length;

    const lateToday = todayAttendance.filter(
      (attendance) => attendance.status === "Late"
    ).length;

    const recentTasks = tasks.slice(0, 5).map((task) => ({
      id: task._id,
      title: task.title,
      className: task.assignedClass?.className || null,
      deadline: task.deadline,
      priority: task.priority,
      status: task.status,
    }));

    const recentSubmissions = submissions
      .slice(0, 5)
      .map((submission) => ({
        id: submission._id,
        taskTitle: submission.task?.title || null,
        studentName: submission.student?.user?.name || null,
        submittedAt: submission.submittedAt,
        status: submission.status,
        marks: submission.marks,
      }));

    const data = {
      teacher: {
        name: teacher.name,
        email: teacher.email,
        department: teacher.department,
      },

      classes: {
        total: classes.length,
        list: classes,
      },

      students: {
        total: studentIds.length,
      },

      tasks: {
        total: tasks.length,
        active: activeTasks,
        closed: closedTasks,
      },

      submissions: {
        total: submissions.length,
        pending: pendingSubmissions,
        reviewed: reviewedSubmissions,
      },

      attendance: {
        today: {
          total: todayAttendance.length,
          present: presentToday,
          absent: absentToday,
          late: lateToday,
        },
      },

      recentTasks,
      recentSubmissions,
    };

    return res.status(200).json({
      success: true,
      message: "Teacher dashboard fetched successfully",

      // New consistent response field
      data,

      // Old frontend compatibility
      dashboard: data,
    });
  } catch (error) {
    console.log("Teacher dashboard error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to load teacher dashboard",
      error: error.message,
    });
  }
};