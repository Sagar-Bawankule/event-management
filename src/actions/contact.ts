"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import ContactInfo from "@/models/ContactInfo";

export interface ContactDetails {
  phone: string;
  email: string;
  address: string;
  updatedAt?: string;
}

const DEFAULT_CONTACT_DETAILS: ContactDetails = {
  phone: "+91 98765 43210",
  email: "events@college.com",
  address: "Admin Office, Main Block, Campus Road",
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function ensureAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return null;
  }
  return session;
}

export async function getContactInfo(): Promise<ContactDetails> {
  try {
    await connectDB();
    const contact = await ContactInfo.findOne()
      .sort({ updatedAt: -1 })
      .select("phone email address updatedAt")
      .lean();

    if (!contact) {
      return DEFAULT_CONTACT_DETAILS;
    }

    return {
      phone: contact.phone || DEFAULT_CONTACT_DETAILS.phone,
      email: contact.email || DEFAULT_CONTACT_DETAILS.email,
      address: contact.address || DEFAULT_CONTACT_DETAILS.address,
      updatedAt: contact.updatedAt ? new Date(contact.updatedAt).toISOString() : undefined,
    };
  } catch (error) {
    console.error("Get contact info error:", error);
    return DEFAULT_CONTACT_DETAILS;
  }
}

export async function updateContactInfo(payload: {
  phone: string;
  email: string;
  address: string;
}) {
  const session = await ensureAdmin();
  if (!session) {
    return { error: "Unauthorized: Admin access required" };
  }

  const phone = payload.phone?.trim() || "";
  const email = payload.email?.trim().toLowerCase() || "";
  const address = payload.address?.trim() || "";

  if (!phone || !email || !address) {
    return { error: "Phone, email, and address are required" };
  }

  if (!isValidEmail(email)) {
    return { error: "Please enter a valid email address" };
  }

  try {
    await connectDB();

    const contact = await ContactInfo.findOneAndUpdate(
      {},
      {
        phone,
        email,
        address,
        updatedBy: session.user.id,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    ).select("phone email address updatedAt");

    revalidatePath("/admin/dashboard");
    revalidatePath("/student/dashboard");

    return {
      success: true,
      contact: {
        phone: contact.phone,
        email: contact.email,
        address: contact.address,
        updatedAt: contact.updatedAt ? new Date(contact.updatedAt).toISOString() : undefined,
      },
    };
  } catch (error) {
    console.error("Update contact info error:", error);
    return { error: "Failed to update contact details" };
  }
}
