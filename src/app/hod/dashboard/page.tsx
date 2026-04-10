import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMyEvents, getDepartmentEvents, getDepartmentParticipationSummary } from "@/actions/hod";
import HodDashboardClient from "./HodDashboardClient";

export default async function HodDashboard() {
  const session = await auth();
  if (!session || session.user.role !== "hod") {
    redirect("/");
  }

  const [events, departmentEvents, participationSummary] = await Promise.all([
    getMyEvents(),
    getDepartmentEvents(),
    getDepartmentParticipationSummary(),
  ]);

  return (
    <HodDashboardClient
      session={session}
      events={events}
      departmentEvents={departmentEvents}
      participationSummary={participationSummary}
    />
  );
}
