"use server";

import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { signIn } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function registerStudent(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const department = formData.get("department") as string;
  const interests = formData.getAll("interests") as string[];

  if (!name || !email || !password || !department) {
    return { error: "All fields are required" };
  }

  try {
    await connectDB();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return { error: "Email already registered" };
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await User.create({
      name,
      email,
      password: hashedPassword,
      role: "student", // HARDCODED - Security: No role selection allowed
      department,
      interests,
      isBlocked: false,
    });

    return { success: true };
  } catch (error) {
    console.error("Registration error:", error);
    return { error: "Registration failed. Please try again." };
  }
}

export async function loginUser(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  try {
    await connectDB();
    const existingUser = await User.findOne({ email }).select("role isBlocked");
    if (!existingUser) {
      return { error: "Invalid email or password" };
    }

    if (existingUser.isBlocked) {
      return { error: "Your account is blocked. Please contact admin." };
    }

    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    const user = await User.findOne({ email }).select("role");
    if (!user) return { error: "Invalid email or password" };

    let redirectUrl = "/student/dashboard";
    if (user.role === "admin") redirectUrl = "/admin/dashboard";
    else if (user.role === "hod") redirectUrl = "/hod/dashboard";

    return { success: true, redirectUrl };
  } catch (error) {
    console.error("Login error:", error);
    return { error: "Invalid email or password" };
  }
}

export async function logoutUser() {
  redirect("/login");
}
