"use server";

import { revalidatePath } from "next/cache";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { auth } from "@/lib/auth";

export async function updateProfile(payload: {
  name?: string;
  department?: string;
  interests?: string[];
  avatar?: string;
}) {
  const session = await auth();
  if (!session) return { error: "Unauthorized" };

  try {
    await connectDB();

    const update: any = {};
    if (payload.name) update.name = payload.name.trim();
    if (payload.department) update.department = payload.department.trim();
    if (payload.interests) update.interests = payload.interests;
    if (payload.avatar) update.avatar = payload.avatar;

    await User.findByIdAndUpdate(session.user.id, update);

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("Update profile error:", error);
    return { error: "Failed to update profile" };
  }
}

export async function getProfile() {
  const session = await auth();
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
