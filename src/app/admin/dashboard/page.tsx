import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAdminStats, getPendingEvents, getAllUsers, getAllEvents } from "@/actions/admin";
import { getContactInfo } from "@/actions/contact";
import AdminDashboardClient from "./AdminDashboardClient";

export default async function AdminDashboard() {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    redirect("/");
  }

  const [stats, pendingEvents, users, allEvents, contactInfo] = await Promise.all([
    getAdminStats(),
    getPendingEvents(),
    getAllUsers("all"),
    getAllEvents(),
    getContactInfo(),
  ]);

  return (
    <Suspense fallback={null}>
      <AdminDashboardClient
        session={session}
        stats={stats}
        pendingEvents={pendingEvents}
        users={users}
        allEvents={allEvents}
        contactInfo={contactInfo}
      />
    </Suspense>
  );
}
