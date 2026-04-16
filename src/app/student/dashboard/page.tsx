import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getRecommendedEvents, getApprovedEvents, getMyRegistrations, getInterestedEvents, getProfile } from "@/actions/student";
import StudentDashboardClient from "./StudentDashboardClient";

export default async function StudentDashboard() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const [recommended, allEvents, myRegistrations, interestedEvents, profile] = await Promise.all([
    getRecommendedEvents(),
    getApprovedEvents(),
    getMyRegistrations(),
    getInterestedEvents(),
    getProfile(),
  ]);

  return (
    <Suspense fallback={null}>
      <StudentDashboardClient
        session={session}
        recommended={recommended}
        allEvents={allEvents}
        myRegistrations={myRegistrations}
        interestedEvents={interestedEvents}
        profile={profile}
      />
    </Suspense>
  );
}
