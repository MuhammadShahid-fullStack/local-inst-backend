import User from "../models/User.js";


// ========================================
// Get My Profile
// Teacher Only (self)
// ========================================

export const getMyProfile = async (req, res) => {
  try {
    const teacher = await User.findById(
      req.user.userId,
      "name email role department createdAt updatedAt"
    );

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher profile not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Teacher profile fetched successfully",
      data: teacher,
    });

  } catch (error) {
    console.log("Get teacher profile error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ========================================
// Update My Profile
// Teacher Only (self)
//
// Only name and department can be changed
// here. role/email/permissions stay
// admin-only (User Management).
// ========================================

export const updateMyProfile = async (req, res) => {
  try {
    const { name, department } = req.body;

    if (name === undefined && department === undefined) {
      return res.status(400).json({
        success: false,
        message: "Provide at least name or department to update",
      });
    }

    const teacher = await User.findById(req.user.userId);

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher profile not found",
      });
    }

    if (name !== undefined) {
      teacher.name = name;
    }

    if (department !== undefined) {
      teacher.department = department;
    }

    await teacher.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",

      data: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        role: teacher.role,
        department: teacher.department,
      },
    });

  } catch (error) {
    console.log("Update teacher profile error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
