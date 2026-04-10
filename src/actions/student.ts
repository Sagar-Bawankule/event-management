"use server";

import { revalidatePath } from "next/cache";
import connectDB from "@/lib/db";
import Event from "@/models/Event";
import User from "@/models/User";
import { auth } from "@/lib/auth";

function includesUserId(ids: Array<unknown> | undefined, userId: string) {
  return (ids || []).some((id) => String(id) === userId);
}

async function ensureStudent() {
  const session = await auth();
  if (!session || session.user.role !== "student") {
    return null;
  }
  return session;
}

function getDaysUntil(dateValue: Date | string) {
  const target = new Date(dateValue).getTime();
  const now = Date.now();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.ceil((target - now) / oneDay);
}

function getStartOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

// ============================================
// Student: Get Recommended Events (AI-style ranking)
// ============================================
export async function getRecommendedEvents() {
  const session = await ensureStudent();
  if (!session) return [];

  try {
    await connectDB();
    const user = await User.findById(session.user.id).select("interests department isBlocked");
    if (!user || user.isBlocked) return [];

    const events = await Event.find({
      status: "approved",
      date: { $gte: getStartOfToday() },
    })
      .populate("organizer", "name department")
      .sort({ date: 1, createdAt: -1 })
      .lean();

    const interestTokens = new Set((user.interests || []).flatMap((interest: string) => tokenize(interest)));

    const ranked = events
      .map((event) => {
        const reasons: string[] = [];
        let score = 0;

        if (includesUserId(event.registeredStudents, session.user.id)) {
          return null;
        }

        if (user.interests?.includes(event.category)) {
          score += 45;
          reasons.push("Matches your interests");
        }

        if (event.department && user.department && event.department === user.department) {
          score += 20;
          reasons.push("From your department");
        }

        const eventTokens = tokenize(`${event.title} ${event.description}`);
        const keywordOverlap = eventTokens.filter((token) => interestTokens.has(token)).length;
        if (keywordOverlap > 0) {
          score += Math.min(20, keywordOverlap * 5);
          reasons.push("Keyword similarity to your profile");
        }

        const daysAway = getDaysUntil(event.date as Date);
        if (daysAway >= 0 && daysAway <= 14) {
          score += 15;
          reasons.push("Happening soon");
        } else if (daysAway > 14 && daysAway <= 45) {
          score += 8;
        }

        const registeredCount = event.registeredStudents?.length || 0;
        const availableRatio = event.capacity > 0 ? (event.capacity - registeredCount) / event.capacity : 0;
        if (availableRatio > 0.5) {
          score += 12;
          reasons.push("Good seat availability");
        } else if (availableRatio > 0) {
          score += 6;
        }

        if (includesUserId(event.interestedStudents, session.user.id)) {
          score += 10;
          reasons.push("You marked this as interested");
        }

        return {
          ...event,
          aiScore: score,
          aiReason: reasons.slice(0, 2).join(". ") || "Popular in your network",
        };
      })
      .filter((event): event is NonNullable<typeof event> => Boolean(event))
      .sort((a, b) => b.aiScore - a.aiScore || new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 8);

    return JSON.parse(JSON.stringify(ranked));
  } catch (error) {
    console.error("Get recommended events error:", error);
    return [];
  }
}

// ============================================
// Student: Get All Approved Events
// ============================================
export async function getApprovedEvents(search?: string, category?: string) {
  try {
    await connectDB();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = {
      status: "approved",
    };
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { venue: { $regex: search, $options: "i" } },
      ];
    }
    if (category && category !== "all") {
      filter.category = category;
    }

    const events = await Event.find(filter)
      .populate("organizer", "name department")
      .sort({ date: -1 })
      .lean();

    return JSON.parse(JSON.stringify(events));
  } catch (error) {
    console.error("Get approved events error:", error);
    return [];
  }
}

// ============================================
// Student: Register for Event
// ============================================
export async function registerForEvent(eventId: string) {
  const session = await ensureStudent();
  if (!session) {
    return { error: "Please login to register" };
  }

  try {
    await connectDB();

    const user = await User.findById(session.user.id).select("isBlocked");
    if (!user || user.isBlocked) {
      return { error: "Your account is blocked. Contact admin." };
    }

    const event = await Event.findById(eventId);
    if (!event) return { error: "Event not found" };
    if (event.status !== "approved") return { error: "Event is not approved" };
    if (new Date(event.date).getTime() < getStartOfToday().getTime()) {
      return { error: "This event has already started or ended" };
    }

    // Check if already registered
    if (includesUserId(event.registeredStudents, session.user.id)) {
      return { error: "Already registered for this event" };
    }

    // Check capacity
    if (event.registeredStudents.length >= event.capacity) {
      return { error: "Event is full. No more registrations." };
    }

    // Add student to event
    await Event.findByIdAndUpdate(eventId, {
      $addToSet: { registeredStudents: session.user.id },
      $pull: { interestedStudents: session.user.id },
    });

    revalidatePath("/student/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Register for event error:", error);
    return { error: "Registration failed" };
  }
}

// ============================================
// Student: Get My Registrations
// ============================================
export async function getMyRegistrations() {
  const session = await ensureStudent();
  if (!session) return [];

  try {
    await connectDB();
    const events = await Event.find({
      registeredStudents: session.user.id,
      status: "approved",
    })
      .populate("organizer", "name department")
      .sort({ date: 1 })
      .lean();

    return JSON.parse(JSON.stringify(events));
  } catch (error) {
    console.error("Get my registrations error:", error);
    return [];
  }
}

// ============================================
// Student: Toggle Event Interest
// ============================================
export async function toggleEventInterest(eventId: string) {
  const session = await ensureStudent();
  if (!session) return { error: "Unauthorized" };

  try {
    await connectDB();

    const user = await User.findById(session.user.id).select("isBlocked");
    if (!user || user.isBlocked) {
      return { error: "Your account is blocked. Contact admin." };
    }

    const event = await Event.findById(eventId).select("status date interestedStudents registeredStudents");
    if (!event) {
      return { error: "Event not found" };
    }

    if (event.status !== "approved") {
      return { error: "Only approved events can be marked as interested" };
    }

    if (new Date(event.date).getTime() < getStartOfToday().getTime()) {
      return { error: "Past events cannot be marked as interested" };
    }

    if (includesUserId(event.registeredStudents, session.user.id)) {
      return { error: "You are already registered for this event" };
    }

    const alreadyInterested = includesUserId(event.interestedStudents, session.user.id);

    await Event.findByIdAndUpdate(eventId, alreadyInterested
      ? { $pull: { interestedStudents: session.user.id } }
      : { $addToSet: { interestedStudents: session.user.id } }
    );

    revalidatePath("/student/dashboard");
    return { success: true, interested: !alreadyInterested };
  } catch (error) {
    console.error("Toggle event interest error:", error);
    return { error: "Failed to update interest" };
  }
}

// ============================================
// Student: Get Interested Events
// ============================================
export async function getInterestedEvents() {
  const session = await ensureStudent();
  if (!session) return [];

  try {
    await connectDB();
    const events = await Event.find({
      interestedStudents: session.user.id,
      status: "approved",
      date: { $gte: getStartOfToday() },
    })
      .populate("organizer", "name department")
      .sort({ date: 1 })
      .lean();

    return JSON.parse(JSON.stringify(events));
  } catch (error) {
    console.error("Get interested events error:", error);
    return [];
  }
}

// ============================================
// Student: Update Profile & Preferences
// ============================================
export async function updateStudentProfile(payload: {
  name?: string;
  department?: string;
  interests?: string[];
}) {
  const session = await ensureStudent();
  if (!session) return { error: "Unauthorized" };

  try {
    await connectDB();

    const update: { name?: string; department?: string; interests?: string[] } = {};

    if (payload.name) {
      update.name = payload.name.trim();
    }
    if (payload.department) {
      update.department = payload.department;
    }
    if (payload.interests) {
      update.interests = payload.interests;
    }

    await User.findByIdAndUpdate(session.user.id, update);

    revalidatePath("/student/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Update profile error:", error);
    return { error: "Failed to update profile" };
  }
}

// ============================================
// Student: Update Interests (Backward compatible)
// ============================================
export async function updateInterests(interests: string[]) {
  return updateStudentProfile({ interests });
}

// ============================================
// Student: Get Profile
// ============================================
export async function getProfile() {
  const session = await ensureStudent();
  if (!session) return null;

  try {
    await connectDB();
    const user = await User.findById(session.user.id).select("-password").lean();
    return JSON.parse(JSON.stringify(user));
  } catch (error) {
    console.error("Get profile error:", error);
    return null;
  }
}
