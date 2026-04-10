import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAdminStats, getPendingEvents, getAllUsers, getAllEvents } from "@/actions/admin";
import AdminDashboardClient from "./AdminDashboardClient";

export default async function AdminDashboard() {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    redirect("/");
  }

  const [stats, pendingEvents, users, allEvents] = await Promise.all([
    getAdminStats(),
    getPendingEvents(),
    getAllUsers("all"),
    getAllEvents(),
  ]);

  return (
    <AdminDashboardClient
      session={session}
      stats={stats}
      pendingEvents={pendingEvents}
      users={users}
      allEvents={allEvents}
    />
  );
}
