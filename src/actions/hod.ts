"use server";

import { revalidatePath } from "next/cache";
import connectDB from "@/lib/db";
import Event from "@/models/Event";
import { auth } from "@/lib/auth";

async function ensureHod() {
  const session = await auth();
  if (!session || session.user.role !== "hod") {
    return null;
  }
  return session;
}

// ============================================
// HOD: Create Event (status = pending, hodRecommendation = pending)
// ============================================
export async function createEvent(formData: FormData) {
  const session = await ensureHod();
  if (!session) {
    return { error: "Unauthorized: HOD access required" };
  }

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const date = formData.get("date") as string;
  const venue = formData.get("venue") as string;
  const category = formData.get("category") as string;
  const capacity = parseInt(formData.get("capacity") as string);
  const bannerUrl = formData.get("bannerUrl") as string;

  if (!title || !description || !date || !venue || !category || !capacity) {
    return { error: "All fields are required" };
  }

  try {
    await connectDB();

    await Event.create({
      title,
      description,
      organizer: session.user.id,
      department: session.user.department || "General",
      date: new Date(date),
      venue,
      category,
      status: "pending",
      hodRecommendation: "pending",
      bannerUrl: bannerUrl || undefined,
      registeredStudents: [],
      interestedStudents: [],
      capacity,
    });

    revalidatePath("/hod/dashboard");
    revalidatePath("/admin/dashboard");
    revalidatePath("/student/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Create event error:", error);
    return { error: "Failed to create event" };
  }
}

// ============================================
// HOD: Get My Events
// ============================================
export async function getMyEvents() {
  const session = await ensureHod();
  if (!session) {
    return [];
  }

  try {
    await connectDB();
    const events = await Event.find({ organizer: session.user.id })
      .populate("registeredStudents", "name email department")
      .sort({ createdAt: -1 })
      .lean();
    return JSON.parse(JSON.stringify(events));
  } catch (error) {
    console.error("Get my events error:", error);
    return [];
  }
}

// ============================================
// HOD: Get Department Events
// ============================================
export async function getDepartmentEvents() {
  const session = await ensureHod();
  if (!session) {
    return [];
  }

  try {
    await connectDB();

    const department = session.user.department;
    if (!department) {
      return [];
    }

    const events = await Event.find({ department })
      .populate("organizer", "name email department")
      .populate("registeredStudents", "name email department")
      .sort({ createdAt: -1 })
      .lean();

    return JSON.parse(JSON.stringify(events));
  } catch (error) {
    console.error("Get department events error:", error);
    return [];
  }
}

// ============================================
// HOD: Recommend Department Event (Stage 1)
// ============================================
export async function approveDepartmentEvent(eventId: string) {
  const session = await ensureHod();
  if (!session) {
    return { error: "Unauthorized" };
  }

  try {
    await connectDB();

    const event = await Event.findById(eventId).select("department status");
    if (!event) {
      return { error: "Event not found" };
    }

    if (event.department !== session.user.department) {
      return { error: "You can only manage events in your own department" };
    }

    if (event.status !== "pending") {
      return { error: "Only pending events can be recommended" };
    }

    await Event.findByIdAndUpdate(eventId, {
      hodRecommendation: "recommended",
      hodReviewedAt: new Date(),
    });

    revalidatePath("/hod/dashboard");
    revalidatePath("/admin/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Recommend department event error:", error);
    return { error: "Failed to recommend event" };
  }
}

// ============================================
// HOD: Mark Department Event as Not Recommended (Stage 1)
// ============================================
export async function rejectDepartmentEvent(eventId: string) {
  const session = await ensureHod();
  if (!session) {
    return { error: "Unauthorized" };
  }

  try {
    await connectDB();

    const event = await Event.findById(eventId).select("department status");
    if (!event) {
      return { error: "Event not found" };
    }

    if (event.department !== session.user.department) {
      return { error: "You can only manage events in your own department" };
    }

    if (event.status !== "pending") {
      return { error: "Only pending events can be reviewed" };
    }

    await Event.findByIdAndUpdate(eventId, {
      hodRecommendation: "not_recommended",
      hodReviewedAt: new Date(),
    });

    revalidatePath("/hod/dashboard");
    revalidatePath("/admin/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Not-recommended department event error:", error);
    return { error: "Failed to update recommendation" };
  }
}

// ============================================
// HOD: Get Attendance for an Event
// ============================================
export async function getEventAttendance(eventId: string) {
  const session = await ensureHod();
  if (!session) {
    return { error: "Unauthorized" };
  }

  try {
    await connectDB();
    const event = await Event.findOne({ _id: eventId, organizer: session.user.id })
      .populate("registeredStudents", "name email department")
      .lean();

    if (!event) {
      return { error: "Event not found" };
    }

    return JSON.parse(JSON.stringify(event));
  } catch (error) {
    console.error("Get attendance error:", error);
    return { error: "Failed to fetch attendance" };
  }
}

// ============================================
// HOD: Department Participation Summary
// ============================================
export async function getDepartmentParticipationSummary() {
  const session = await ensureHod();
  if (!session) {
    return [];
  }

  try {
    await connectDB();

    const department = session.user.department;
    if (!department) {
      return [];
    }

    const events = await Event.find({ department })
      .select("title date status capacity registeredStudents")
      .sort({ date: 1 })
      .lean();

    const summary = events.map((event) => {
      const registrationCount = event.registeredStudents?.length || 0;
      const fillRate = event.capacity > 0 ? Number(((registrationCount / event.capacity) * 100).toFixed(1)) : 0;
      return {
        _id: event._id,
        title: event.title,
        date: event.date,
        status: event.status,
        capacity: event.capacity,
        registrationCount,
        fillRate,
      };
    });

    return JSON.parse(JSON.stringify(summary));
  } catch (error) {
    console.error("Department participation summary error:", error);
    return [];
  }
}
