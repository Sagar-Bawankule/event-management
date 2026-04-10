"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Event from "@/models/Event";
import { auth } from "@/lib/auth";

type UserRole = "student" | "hod" | "admin";

function normalizeRole(role: string | null): UserRole | null {
  if (role === "student" || role === "hod" || role === "admin") {
    return role;
  }
  return null;
}

async function ensureAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return null;
  }
  return session;
}

// ============================================
// Admin-only: Create User (Student/HOD/Admin)
// ============================================
export async function createUser(formData: FormData) {
  const session = await ensureAdmin();
  if (!session) {
    return { error: "Unauthorized: Admin access required" };
  }

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const role = normalizeRole((formData.get("role") as string) || "student");
  const department = formData.get("department") as string;
  const password = (formData.get("password") as string) || "user123";
  const interests = formData.getAll("interests") as string[];

  if (!name || !email || !role) {
    return { error: "Name, email and role are required" };
  }

  if ((role === "student" || role === "hod") && !department) {
    return { error: "Department is required for Student/HOD users" };
  }

  try {
    await connectDB();

    const existing = await User.findOne({ email });
    if (existing) {
      return { error: "Email already exists" };
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      department: department || undefined,
      interests: role === "student" ? interests : [],
      isBlocked: false,
    });

    revalidatePath("/admin/dashboard");
    return { success: true, message: `${role.toUpperCase()} created successfully` };
  } catch (error) {
    console.error("Create user error:", error);
    return { error: "Failed to create user" };
  }
}

// ============================================
// Admin-only: Backward-compatible HOD Creator
// ============================================
export async function createHod(formData: FormData) {
  formData.set("role", "hod");
  if (!formData.get("password")) {
    formData.set("password", "hod123");
  }
  return createUser(formData);
}

// ============================================
// Admin-only: Approve Event
// ============================================
export async function approveEvent(eventId: string) {
  const session = await ensureAdmin();
  if (!session) {
    return { error: "Unauthorized" };
  }

  try {
    await connectDB();

    const event = await Event.findById(eventId).select("status hodRecommendation");
    if (!event) {
      return { error: "Event not found" };
    }

    if (event.status !== "pending") {
      return { error: "Only pending events can be approved" };
    }

    if (event.hodRecommendation !== "recommended") {
      return { error: "HOD recommendation is required before admin approval" };
    }

    await Event.findByIdAndUpdate(eventId, { status: "approved" });
    revalidatePath("/admin/dashboard");
    revalidatePath("/hod/dashboard");
    revalidatePath("/student/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Approve event error:", error);
    return { error: "Failed to approve event" };
  }
}

// ============================================
// Admin-only: Reject Event
// ============================================
export async function rejectEvent(eventId: string) {
  const session = await ensureAdmin();
  if (!session) {
    return { error: "Unauthorized" };
  }

  try {
    await connectDB();

    const event = await Event.findById(eventId).select("status hodRecommendation");
    if (!event) {
      return { error: "Event not found" };
    }

    if (event.status !== "pending") {
      return { error: "Only pending events can be rejected" };
    }

    if (event.hodRecommendation !== "recommended") {
      return { error: "HOD recommendation is required before admin decision" };
    }

    await Event.findByIdAndUpdate(eventId, { status: "rejected" });
    revalidatePath("/admin/dashboard");
    revalidatePath("/hod/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Reject event error:", error);
    return { error: "Failed to reject event" };
  }
}

// ============================================
// Admin-only: Delete Student
// ============================================
export async function deleteUser(userId: string) {
  const session = await ensureAdmin();
  if (!session) {
    return { error: "Unauthorized" };
  }

  try {
    await connectDB();

    if (session.user.id === userId) {
      return { error: "You cannot delete your own account" };
    }

    const target = await User.findById(userId).select("role");
    if (!target) {
      return { error: "User not found" };
    }

    if (target.role === "admin") {
      return { error: "Admin users cannot be deleted" };
    }

    await User.findByIdAndDelete(userId);

    // Remove student from all event registrations
    await Event.updateMany(
      { registeredStudents: userId },
      { $pull: { registeredStudents: userId } }
    );

    await Event.updateMany(
      { interestedStudents: userId },
      { $pull: { interestedStudents: userId } }
    );

    await Event.deleteMany({ organizer: userId });

    revalidatePath("/admin/dashboard");
    revalidatePath("/hod/dashboard");
    revalidatePath("/student/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Delete user error:", error);
    return { error: "Failed to delete user" };
  }
}

// ============================================
// Admin-only: Block / Unblock User
// ============================================
export async function toggleUserBlock(userId: string, shouldBlock: boolean) {
  const session = await ensureAdmin();
  if (!session) {
    return { error: "Unauthorized" };
  }

  try {
    await connectDB();

    if (session.user.id === userId) {
      return { error: "You cannot block your own account" };
    }

    const target = await User.findById(userId).select("role");
    if (!target) {
      return { error: "User not found" };
    }

    if (target.role === "admin") {
      return { error: "Admin users cannot be blocked" };
    }

    if (shouldBlock) {
      await User.findByIdAndUpdate(userId, {
        isBlocked: true,
        blockedAt: new Date(),
      });
    } else {
      await User.findByIdAndUpdate(userId, {
        isBlocked: false,
        $unset: { blockedAt: 1 },
      });
    }

    revalidatePath("/admin/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Toggle user block error:", error);
    return { error: "Failed to update user block status" };
  }
}

// ============================================
// Admin-only: Delete Event
// ============================================
export async function deleteEvent(eventId: string) {
  const session = await ensureAdmin();
  if (!session) {
    return { error: "Unauthorized" };
  }

  try {
    await connectDB();
    const deleted = await Event.findByIdAndDelete(eventId);
    if (!deleted) {
      return { error: "Event not found" };
    }

    revalidatePath("/admin/dashboard");
    revalidatePath("/hod/dashboard");
    revalidatePath("/student/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Delete event error:", error);
    return { error: "Failed to delete event" };
  }
}

// ============================================
// Admin: Get Dashboard Analytics
// ============================================
export async function getAdminStats() {
  try {
    await connectDB();
    const [
      totalUsers,
      totalStudents,
      totalHods,
      totalBlockedUsers,
      totalEvents,
      pendingEvents,
      approvedEvents,
      rejectedEvents,
      eventSnapshots,
    ] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: "student" }),
        User.countDocuments({ role: "hod" }),
        User.countDocuments({ isBlocked: true }),
        Event.countDocuments(),
        Event.countDocuments({ status: "pending", hodRecommendation: "recommended" }),
        Event.countDocuments({ status: "approved" }),
        Event.countDocuments({ status: "rejected" }),
        Event.find().select("capacity registeredStudents interestedStudents").lean(),
      ]);

    const totalRegistrations = eventSnapshots.reduce(
      (acc, event) => acc + (event.registeredStudents?.length || 0),
      0
    );
    const totalInterestedMarks = eventSnapshots.reduce(
      (acc, event) => acc + (event.interestedStudents?.length || 0),
      0
    );
    const totalCapacity = eventSnapshots.reduce(
      (acc, event) => acc + (event.capacity || 0),
      0
    );

    const avgEventFillRate =
      totalCapacity > 0 ? Number(((totalRegistrations / totalCapacity) * 100).toFixed(1)) : 0;

    const engagementRate =
      totalUsers > 0
        ? Number((((totalRegistrations + totalInterestedMarks) / totalUsers) * 100).toFixed(1))
        : 0;

    return {
      totalUsers,
      totalStudents,
      totalHods,
      totalBlockedUsers,
      totalEvents,
      pendingEvents,
      approvedEvents,
      rejectedEvents,
      totalRegistrations,
      totalInterestedMarks,
      avgEventFillRate,
      engagementRate,
    };
  } catch (error) {
    console.error("Stats error:", error);
    return {
      totalUsers: 0,
      totalStudents: 0,
      totalHods: 0,
      totalBlockedUsers: 0,
      totalEvents: 0,
      pendingEvents: 0,
      approvedEvents: 0,
      rejectedEvents: 0,
      totalRegistrations: 0,
      totalInterestedMarks: 0,
      avgEventFillRate: 0,
      engagementRate: 0,
    };
  }
}

// ============================================
// Admin: Get all pending events
// ============================================
export async function getPendingEvents() {
  try {
    await connectDB();
    const events = await Event.find({
      status: "pending",
      hodRecommendation: "recommended",
    })
      .populate("organizer", "name email department")
      .sort({ createdAt: -1 })
      .lean();
    return JSON.parse(JSON.stringify(events));
  } catch (error) {
    console.error("Get pending events error:", error);
    return [];
  }
}

// ============================================
// Admin: Get all users
// ============================================
export async function getAllUsers(role?: string) {
  try {
    await connectDB();
    const filter = role && role !== "all" ? { role } : {};
    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();
    return JSON.parse(JSON.stringify(users));
  } catch (error) {
    console.error("Get users error:", error);
    return [];
  }
}

// ============================================
// Admin: Get all events
// ============================================
export async function getAllEvents() {
  try {
    await connectDB();
    const events = await Event.find()
      .populate("organizer", "name email department")
      .sort({ createdAt: -1 })
      .lean();
    return JSON.parse(JSON.stringify(events));
  } catch (error) {
    console.error("Get all events error:", error);
    return [];
  }
}

// ============================================
// Admin: Aggregated Report Data
// ============================================
export async function getAdminReportData() {
  try {
    await connectDB();

    const [users, events] = await Promise.all([
      User.find().select("name email role department isBlocked createdAt").lean(),
      Event.find()
        .populate("organizer", "name email department")
        .select("title category department status hodRecommendation date capacity registeredStudents interestedStudents organizer")
        .lean(),
    ]);

    return {
      users: JSON.parse(JSON.stringify(users)),
      events: JSON.parse(JSON.stringify(events)),
    };
  } catch (error) {
    console.error("Get report data error:", error);
    return { users: [], events: [] };
  }
}
