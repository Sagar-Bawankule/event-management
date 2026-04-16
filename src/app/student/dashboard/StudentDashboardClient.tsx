"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Brain,
  Calendar,
  Heart,
  MapPin,
  Search,
  Sparkles,
  Tag,
  Ticket,
  User,
  Users,
} from "lucide-react";
import { Session } from "next-auth";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toaster";
import {
  registerForEvent,
  toggleEventInterest,
  updateStudentProfile,
} from "@/actions/student";
import { DEPARTMENTS, INTEREST_TAGS } from "@/lib/constants";
import DashboardLayout from "@/components/DashboardLayout";
import StudentChatbot from "@/components/StudentChatbot";

interface DashboardEvent {
  _id: string;
  title: string;
  description: string;
  date: string;
  venue: string;
  category: string;
  status: string;
  department?: string;
  bannerUrl?: string;
  capacity: number;
  aiScore?: number;
  aiReason?: string;
  organizer?: {
    name?: string;
    department?: string;
  };
  registeredStudents?: unknown[];
  interestedStudents?: unknown[];
}

function isPastEvent(dateValue: string) {
  const eventDate = new Date(dateValue);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return eventDate.getTime() < startOfToday.getTime();
}

interface StudentProfile {
  _id: string;
  name?: string;
  department?: string;
  interests?: string[];
}

interface StudentDashboardClientProps {
  session: Session;
  recommended: DashboardEvent[];
  allEvents: DashboardEvent[];
  myRegistrations: DashboardEvent[];
  interestedEvents: DashboardEvent[];
  profile: StudentProfile | null;
}

export default function StudentDashboardClient({
  session,
  recommended,
  allEvents,
  myRegistrations,
  interestedEvents,
  profile,
}: StudentDashboardClientProps) {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [profileName, setProfileName] = useState(profile?.name || session.user.name || "");
  const [profileDepartment, setProfileDepartment] = useState(
    profile?.department || session.user.department || ""
  );
  const [interests, setInterests] = useState<string[]>(profile?.interests || []);

  const registeredIds = useMemo(
    () => new Set(myRegistrations.map((event) => event._id)),
    [myRegistrations]
  );

  const interestedIds = useMemo(
    () => new Set(interestedEvents.map((event) => event._id)),
    [interestedEvents]
  );

  const filteredEvents = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return allEvents.filter((event) => {
      const matchesSearch =
        !searchText ||
        `${event.title} ${event.description} ${event.venue} ${event.organizer?.name || ""}`
          .toLowerCase()
          .includes(searchText);

      const matchesCategory = categoryFilter === "all" || event.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [allEvents, search, categoryFilter]);

  async function handleRegister(eventId: string) {
    setActionLoadingId(eventId);
    const result = await registerForEvent(eventId);
    setActionLoadingId(null);

    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      return;
    }

    toast({ title: "Registered", description: "Event registration completed.", variant: "success" });
    router.refresh();
  }

  async function handleToggleInterest(eventId: string) {
    setActionLoadingId(eventId);
    const result = await toggleEventInterest(eventId);
    setActionLoadingId(null);

    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      return;
    }

    toast({
      title: result.interested ? "Marked as interested" : "Interest removed",
      description: "Your preferences have been updated.",
      variant: "success",
    });

    router.refresh();
  }

  async function handleSaveProfile() {
    const result = await updateStudentProfile({
      name: profileName,
      department: profileDepartment,
      interests,
    });

    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      return;
    }

    toast({ title: "Profile updated", description: "Preferences saved successfully.", variant: "success" });
    setProfileDialogOpen(false);
    router.refresh();
  }

  function toggleInterestTag(tag: string) {
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  }

  function EventCard({ event, showAiReason = false }: { event: DashboardEvent; showAiReason?: boolean }) {
    const isRegistered = registeredIds.has(event._id);
    const isInterested = interestedIds.has(event._id);
    const registrations = event.registeredStudents?.length || 0;
    const isFull = registrations >= event.capacity;
    const isPast = isPastEvent(event.date);

    return (
      <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 h-full flex flex-col">
        <div className="h-36 bg-gradient-to-br from-violet-500 to-purple-600 relative overflow-hidden">
          {event.bannerUrl && (
            <Image
              src={event.bannerUrl}
              alt={event.title}
              fill
              className="object-cover opacity-80"
            />
          )}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <Badge className="bg-white/90 text-violet-700 hover:bg-white">{event.category}</Badge>
            {showAiReason && typeof event.aiScore === "number" && (
              <Badge variant="outline" className="bg-white/90 text-violet-700 border-violet-200">
                Score {event.aiScore}
              </Badge>
            )}
          </div>
        </div>

        <CardHeader className="pb-2">
          <CardTitle className="text-lg line-clamp-1">{event.title}</CardTitle>
          <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
        </CardHeader>

        <CardContent className="space-y-2 flex-1">
          <div className="flex items-center text-sm text-muted-foreground gap-2">
            <Calendar className="h-4 w-4 text-violet-500" />
            {new Date(event.date).toLocaleDateString()}
          </div>
          <div className="flex items-center text-sm text-muted-foreground gap-2">
            <MapPin className="h-4 w-4 text-violet-500" />
            {event.venue}
          </div>
          <div className="flex items-center text-sm text-muted-foreground gap-2">
            <Users className="h-4 w-4 text-violet-500" />
            {registrations} / {event.capacity} seats
          </div>
          <div className="flex items-center text-sm text-muted-foreground gap-2">
            <Tag className="h-4 w-4 text-violet-500" />
            {event.organizer?.name || "Organizer"}
            {event.organizer?.department ? ` (${event.organizer.department})` : ""}
          </div>

          {showAiReason && event.aiReason && (
            <div className="rounded-md border border-indigo-100 bg-indigo-50 p-2 text-xs text-indigo-700 flex gap-2">
              <Brain className="h-3.5 w-3.5 mt-0.5" />
              <span>{event.aiReason}</span>
            </div>
          )}
        </CardContent>

        <CardFooter>
          {isRegistered ? (
            <Button variant="outline" className="w-full" disabled>
              <Ticket className="mr-2 h-4 w-4" /> Registered
            </Button>
          ) : isPast ? (
            <Button variant="outline" className="w-full" disabled>
              <Calendar className="mr-2 h-4 w-4" /> Ended
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button
                variant={isInterested ? "secondary" : "outline"}
                onClick={() => handleToggleInterest(event._id)}
                disabled={actionLoadingId === event._id || isPast}
              >
                <Heart className="mr-2 h-4 w-4" />
                {isInterested ? "Interested" : "Interest"}
              </Button>

              <Button
                onClick={() => handleRegister(event._id)}
                disabled={actionLoadingId === event._id || isFull}
              >
                {actionLoadingId === event._id
                  ? "Working..."
                  : isFull
                  ? "Full"
                  : "Register"}
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    );
  }

  return (
    <DashboardLayout session={session} role="student">
      <div className="space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome, {session.user?.name?.split(" ")[0] || "Student"}
            </h1>
            <p className="text-muted-foreground mt-1">
              Explore events, mark interests, and get AI-based recommendations.
            </p>
          </div>

          <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <User className="mr-2 h-4 w-4" /> Profile & Preferences
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Update Profile</DialogTitle>
                <DialogDescription>
                  Manage profile details and recommendation preferences.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="student-name">Name</Label>
                  <Input
                    id="student-name"
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={profileDepartment} onValueChange={setProfileDepartment}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((department) => (
                        <SelectItem key={department} value={department}>
                          {department}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Interests</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto border rounded-md p-3">
                    {INTEREST_TAGS.map((tag) => (
                      <div key={tag} className="flex items-center gap-2">
                        <Checkbox
                          id={`profile-${tag}`}
                          checked={interests.includes(tag)}
                          onCheckedChange={() => toggleInterestTag(tag)}
                        />
                        <Label htmlFor={`profile-${tag}`} className="text-xs">
                          {tag}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Button className="w-full" onClick={handleSaveProfile}>
                  <Heart className="mr-2 h-4 w-4" /> Save Profile
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {recommended.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-600" />
              <h2 className="text-xl font-semibold">AI Recommendations</h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {recommended.map((event) => (
                <EventCard key={`rec-${event._id}`} event={event} showAiReason={true} />
              ))}
            </div>
          </section>
        )}

        <Tabs value={searchParams.get("tab") || "explore"} className="space-y-4">
          <TabsContent value="explore" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search events by title, venue, or organizer"
                  className="pl-10"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {INTEREST_TAGS.map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filteredEvents.length === 0 ? (
              <div className="text-center py-14 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="text-lg">No events found</p>
                <p className="text-sm">
                  {allEvents.length === 0 && !search && categoryFilter === "all"
                    ? "No approved upcoming events yet. Ask HOD to recommend and Admin to approve events."
                    : "Adjust your filters to find more events."}
                </p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredEvents.map((event) => (
                  <EventCard key={event._id} event={event} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="interested">
            {interestedEvents.length === 0 ? (
              <div className="text-center py-14 text-muted-foreground">
                <Heart className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="text-lg">No interested events yet</p>
                <p className="text-sm">Mark events as interested to revisit them quickly.</p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {interestedEvents.map((event) => (
                  <EventCard key={`interest-${event._id}`} event={event} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="registered">
            {myRegistrations.length === 0 ? (
              <div className="text-center py-14 text-muted-foreground">
                <Ticket className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="text-lg">No registrations yet</p>
                <p className="text-sm">Register for events to see them here.</p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {myRegistrations.map((event) => (
                  <EventCard key={`reg-${event._id}`} event={event} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      <StudentChatbot />
    </DashboardLayout>
  );
}
