"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Brain,
  Calendar,
  Compass,
  Heart,
  Mail,
  MapPin,
  PartyPopper,
  Phone,
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
import { cn } from "@/lib/utils";
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

interface StudentProfile {
  _id: string;
  name?: string;
  department?: string;
  interests?: string[];
}

interface ContactDetails {
  phone: string;
  email: string;
  address: string;
  updatedAt?: string;
}

interface StudentDashboardClientProps {
  session: Session;
  recommended: DashboardEvent[];
  allEvents: DashboardEvent[];
  myRegistrations: DashboardEvent[];
  interestedEvents: DashboardEvent[];
  profile: StudentProfile | null;
  contactInfo: ContactDetails;
}

interface IllustrationTile {
  id: string;
  key: string;
  badge: string;
  title: string;
  subtitle: string;
  image: string;
  tint: string;
}

type EventTheme = {
  keys: string[];
  banner: string;
  badge: string;
  progress: string;
};

const EVENT_THEME_PRESETS: EventTheme[] = [
  {
    keys: ["coding", "hackathon", "ai/ml", "web development", "robotics"],
    banner: "from-cyan-500 via-sky-500 to-blue-600",
    badge: "border-cyan-200 bg-cyan-50 text-cyan-700",
    progress: "from-cyan-500 to-blue-600",
  },
  {
    keys: ["cultural", "dance", "music", "art", "fest"],
    banner: "from-rose-500 via-orange-500 to-amber-500",
    badge: "border-orange-200 bg-orange-50 text-orange-700",
    progress: "from-orange-500 to-rose-500",
  },
  {
    keys: ["sports"],
    banner: "from-emerald-500 via-lime-500 to-teal-500",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    progress: "from-emerald-500 to-teal-500",
  },
  {
    keys: ["seminar", "workshop", "networking", "debate", "quiz", "literature"],
    banner: "from-indigo-500 via-blue-500 to-cyan-500",
    badge: "border-indigo-200 bg-indigo-50 text-indigo-700",
    progress: "from-indigo-500 to-cyan-500",
  },
];

const DEFAULT_EVENT_THEME: EventTheme = {
  keys: [],
  banner: "from-slate-700 via-slate-600 to-slate-500",
  badge: "border-slate-200 bg-slate-50 text-slate-700",
  progress: "from-slate-500 to-slate-700",
};

const ILLUSTRATION_TILES: IllustrationTile[] = [
  {
    id: "tech",
    key: "coding",
    badge: "Tech Nights",
    title: "Build Under Spotlight",
    subtitle: "Hackathons, coding marathons, and rapid-fire prototype sprints.",
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&q=80",
    tint: "from-cyan-600/30 via-blue-600/25 to-slate-900/70",
  },
  {
    id: "dance",
    key: "dance",
    badge: "Stage Vibes",
    title: "Lights, Music, Motion",
    subtitle: "Dance battles, cultural showcases, and performance evenings.",
    image: "https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?auto=format&fit=crop&w=1400&q=80",
    tint: "from-rose-500/35 via-orange-500/20 to-slate-900/75",
  },
  {
    id: "sports",
    key: "sports",
    badge: "Game Day",
    title: "Arena Energy",
    subtitle: "Tournaments, crowd chants, and department-level rivalries.",
    image: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1400&q=80",
    tint: "from-emerald-500/35 via-teal-500/25 to-slate-900/75",
  },
  {
    id: "workshop",
    key: "workshop",
    badge: "Hands-On",
    title: "Learn By Building",
    subtitle: "Workshops and masterclasses with practical, project-based sessions.",
    image: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1400&q=80",
    tint: "from-indigo-500/35 via-blue-500/20 to-slate-900/70",
  },
  {
    id: "networking",
    key: "networking",
    badge: "Meet & Connect",
    title: "People. Ideas. Momentum.",
    subtitle: "Meet mentors, alumni, and peers through high-value mixers.",
    image: "https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=1400&q=80",
    tint: "from-amber-500/35 via-orange-500/20 to-slate-900/75",
  },
  {
    id: "culture",
    key: "cultural",
    badge: "Festival Mode",
    title: "Campus Culture Pulse",
    subtitle: "Fests, music nights, and stories that make campus unforgettable.",
    image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1400&q=80",
    tint: "from-fuchsia-500/30 via-pink-500/20 to-slate-900/75",
  },
];

const gridVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0 },
};

function isPastEvent(dateValue: string) {
  const eventDate = new Date(dateValue);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return eventDate.getTime() < startOfToday.getTime();
}

function getCategoryTheme(category: string) {
  const normalized = category.toLowerCase();
  return (
    EVENT_THEME_PRESETS.find((theme) =>
      theme.keys.some((item) => normalized.includes(item))
    ) || DEFAULT_EVENT_THEME
  );
}

function formatDateLabel(dateValue: string) {
  return new Date(dateValue).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function StudentDashboardClient({
  session,
  recommended,
  allEvents,
  myRegistrations,
  interestedEvents,
  profile,
  contactInfo,
}: StudentDashboardClientProps) {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "explore";

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [eventDetailsOpen, setEventDetailsOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<DashboardEvent | null>(null);
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

  const categoryOptions = useMemo(() => {
    const categories = Array.from(
      new Set(allEvents.map((event) => event.category).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    return categories.length > 0 ? categories : [...INTEREST_TAGS];
  }, [allEvents]);

  const dashboardStats = useMemo(() => {
    const liveEvents = allEvents.filter((event) => !isPastEvent(event.date)).length;
    const openSeats = allEvents.reduce((sum, event) => {
      const registrations = event.registeredStudents?.length || 0;
      return sum + Math.max(event.capacity - registrations, 0);
    }, 0);

    return [
      {
        id: "live",
        label: "Live Events",
        value: liveEvents,
        helper: `${openSeats} seats still open`,
        icon: PartyPopper,
        tone: "from-amber-500 to-orange-500",
      },
      {
        id: "recommended",
        label: "AI Picks",
        value: recommended.length,
        helper: "Personalized for your profile",
        icon: Sparkles,
        tone: "from-cyan-500 to-blue-600",
      },
      {
        id: "interested",
        label: "Interested",
        value: interestedEvents.length,
        helper: "Saved for later",
        icon: Heart,
        tone: "from-rose-500 to-pink-500",
      },
      {
        id: "registered",
        label: "My Tickets",
        value: myRegistrations.length,
        helper: "Confirmed registrations",
        icon: Ticket,
        tone: "from-emerald-500 to-teal-500",
      },
    ];
  }, [allEvents, interestedEvents.length, myRegistrations.length, recommended.length]);

  const highlightedEvents = useMemo(() => {
    return allEvents.filter((event) => !isPastEvent(event.date)).slice(0, 3);
  }, [allEvents]);

  const visualStoryTiles = useMemo(() => {
    const normalizedInterests = interests.map((item) => item.toLowerCase().trim());

    const matched = ILLUSTRATION_TILES.filter((tile) =>
      normalizedInterests.some((interest) =>
        interest.includes(tile.key) || tile.key.includes(interest)
      )
    );

    const merged = [...matched, ...ILLUSTRATION_TILES].reduce<IllustrationTile[]>((acc, tile) => {
      if (!acc.some((item) => item.id === tile.id)) {
        acc.push(tile);
      }
      return acc;
    }, []);

    return merged.slice(0, 3);
  }, [interests]);

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

  function handleTabChange(nextTab: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.push(`/student/dashboard?${params.toString()}`);
  }

  function toggleInterestTag(tag: string) {
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  }

  function openEventDetails(event: DashboardEvent) {
    setSelectedEvent(event);
    setEventDetailsOpen(true);
  }

  function EventCard({ event, showAiReason = false }: { event: DashboardEvent; showAiReason?: boolean }) {
    const isRegistered = registeredIds.has(event._id);
    const isInterested = interestedIds.has(event._id);
    const registrations = event.registeredStudents?.length || 0;
    const availableSeats = Math.max(event.capacity - registrations, 0);
    const fillPercent = event.capacity > 0 ? Math.min(100, Math.round((registrations / event.capacity) * 100)) : 0;
    const isFull = registrations >= event.capacity;
    const isPast = isPastEvent(event.date);
    const theme = getCategoryTheme(event.category);

    return (
      <Card
        className="group h-full overflow-hidden rounded-3xl border border-slate-200/90 bg-white/90 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={() => openEventDetails(event)}
        onKeyDown={(keyboardEvent) => {
          if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
            keyboardEvent.preventDefault();
            openEventDetails(event);
          }
        }}
      >
        <div className={cn("relative h-40 overflow-hidden bg-gradient-to-br", theme.banner)}>
          {event.bannerUrl && (
            <Image
              src={event.bannerUrl}
              alt={event.title}
              fill
              className="object-cover opacity-85 transition-transform duration-500 group-hover:scale-105"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-900/20 to-transparent" />
          <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
            <Badge className={cn("border shadow-sm backdrop-blur-sm", theme.badge)}>{event.category}</Badge>
            {showAiReason && typeof event.aiScore === "number" && (
              <Badge variant="outline" className="border-white/70 bg-white/85 text-slate-800 shadow-sm">
                Score {event.aiScore}
              </Badge>
            )}
          </div>

          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3 text-xs text-white">
            <span className="rounded-full bg-white/20 px-2.5 py-1 backdrop-blur-sm">
              {formatDateLabel(event.date)}
            </span>
            {isPast ? (
              <span className="rounded-full bg-red-500/70 px-2.5 py-1 backdrop-blur-sm">Closed</span>
            ) : isFull ? (
              <span className="rounded-full bg-rose-500/70 px-2.5 py-1 backdrop-blur-sm">Sold Out</span>
            ) : (
              <span className="rounded-full bg-emerald-500/70 px-2.5 py-1 backdrop-blur-sm">{availableSeats} seats left</span>
            )}
          </div>
        </div>

        <CardHeader className="pb-3 pt-4">
          <CardTitle className="line-clamp-1 text-xl font-bold tracking-tight text-slate-900">{event.title}</CardTitle>
          <p className="line-clamp-2 text-sm text-slate-600">{event.description}</p>
        </CardHeader>

        <CardContent className="flex-1 space-y-3 pb-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Calendar className="h-4 w-4 text-sky-600" />
              {formatDateLabel(event.date)}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <MapPin className="h-4 w-4 text-sky-600" />
              {event.venue}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Users className="h-4 w-4 text-sky-600" />
              {registrations} / {event.capacity} seats filled
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Tag className="h-4 w-4 text-sky-600" />
              {event.organizer?.name || "Organizer"}
              {event.organizer?.department ? ` (${event.organizer.department})` : ""}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-600">
              <span>Seat Availability</span>
              <span>{availableSeats} left</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div
                className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-300", theme.progress)}
                style={{ width: `${fillPercent}%` }}
              />
            </div>
          </div>

          {showAiReason && event.aiReason && (
            <div className="flex gap-2 rounded-xl border border-cyan-100 bg-cyan-50 p-2 text-xs text-cyan-800">
              <Brain className="mt-0.5 h-3.5 w-3.5" />
              <span>{event.aiReason}</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="mt-auto">
          {isRegistered ? (
            <Button variant="outline" className="w-full border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-50" disabled>
              <Ticket className="mr-2 h-4 w-4" /> Ticket Confirmed
            </Button>
          ) : isPast ? (
            <Button variant="outline" className="w-full border-slate-300 text-slate-600" disabled>
              <Calendar className="mr-2 h-4 w-4" /> Ended
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button
                variant="outline"
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  handleToggleInterest(event._id);
                }}
                disabled={actionLoadingId === event._id || isPast}
                className={cn(
                  "border-slate-300 text-slate-700 hover:bg-slate-100",
                  isInterested && "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                )}
              >
                <Heart className="mr-2 h-4 w-4" />
                {isInterested ? "Interested" : "Interest"}
              </Button>

              <Button
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  handleRegister(event._id);
                }}
                disabled={actionLoadingId === event._id || isFull}
                className="border-0 bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-md hover:from-orange-600 hover:to-rose-600"
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

  const selectedEventRegistrations = selectedEvent?.registeredStudents?.length || 0;
  const selectedEventAvailableSeats = selectedEvent
    ? Math.max(selectedEvent.capacity - selectedEventRegistrations, 0)
    : 0;

  return (
    <DashboardLayout session={session} role="student">
      <div className="relative space-y-8">
        <div className="pointer-events-none absolute inset-x-0 -top-20 -z-10 h-[440px] bg-[radial-gradient(circle_at_8%_10%,rgba(251,191,36,0.30),transparent_34%),radial-gradient(circle_at_85%_18%,rgba(6,182,212,0.24),transparent_40%),radial-gradient(circle_at_50%_80%,rgba(249,115,22,0.16),transparent_46%)]" />

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-br from-amber-50 via-white to-cyan-50 p-6 shadow-xl shadow-orange-100/60 sm:p-8"
        >
          <div className="pointer-events-none absolute -left-16 -top-20 h-52 w-52 rounded-full bg-amber-300/25 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 -bottom-16 h-52 w-52 rounded-full bg-cyan-300/25 blur-3xl" />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-700 backdrop-blur-sm">
                <PartyPopper className="h-3.5 w-3.5" />
                Campus Event Arena
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                Hey {session.user?.name?.split(" ")[0] || "Student"}, your event season is live
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Discover college fests, workshops, hackathons, and cultural experiences from one curated space.
                Pick what excites you, save favorites, and lock your seats before they fill up.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {highlightedEvents.length > 0 ? (
                  highlightedEvents.map((event) => (
                    <span
                      key={`highlight-${event._id}`}
                      className="rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {event.title}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-xs font-medium text-slate-700">
                    No live events right now. Stay tuned.
                  </span>
                )}
              </div>
            </div>

            <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
              <DialogTrigger asChild>
                <Button className="border-0 bg-gradient-to-r from-slate-900 to-slate-700 text-white shadow-md hover:from-slate-800 hover:to-slate-600">
                  <User className="mr-2 h-4 w-4" /> Profile & Preferences
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg border-slate-200">
                <DialogHeader>
                  <DialogTitle>Update Profile</DialogTitle>
                  <DialogDescription>
                    Keep your details and interest tags updated to get sharper event recommendations.
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
                    <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
                      {INTEREST_TAGS.map((tag) => (
                        <div key={tag} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-slate-50">
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

                  <Button className="w-full border-0 bg-gradient-to-r from-orange-500 to-rose-500 text-white hover:from-orange-600 hover:to-rose-600" onClick={handleSaveProfile}>
                    <Heart className="mr-2 h-4 w-4" /> Save Profile
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </motion.section>

        <motion.section
          variants={gridVariants}
          initial="hidden"
          animate="show"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {dashboardStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <motion.div key={stat.id} variants={cardVariants}>
                <Card className="rounded-2xl border border-white/70 bg-white/85 shadow-md backdrop-blur-sm">
                  <CardContent className="p-5">
                    <div className={cn("mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow", stat.tone)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{stat.value}</p>
                    <p className="mt-1 text-xs text-slate-500">{stat.helper}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Campus Vibes</h2>
              <p className="text-sm text-slate-600">
                Visual picks aligned with your interests so the dashboard feels alive.
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700">
              Illustration Storyboard
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visualStoryTiles.map((tile) => (
              <article
                key={tile.id}
                className="group relative overflow-hidden rounded-3xl border border-white/70 shadow-md"
              >
                <div className="relative h-56 w-full sm:h-60">
                  <Image
                    src={tile.image}
                    alt={tile.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className={cn("absolute inset-0 bg-gradient-to-br", tile.tint)} />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/30 to-transparent" />

                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <Badge className="mb-2 border-white/40 bg-white/15 text-white backdrop-blur-sm">
                      {tile.badge}
                    </Badge>
                    <h3 className="text-xl font-bold tracking-tight text-white">{tile.title}</h3>
                    <p className="mt-1 max-w-xl text-sm text-slate-100/90">{tile.subtitle}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </motion.section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-cyan-600" />
              <h2 className="text-xl font-bold tracking-tight text-slate-900">AI Recommendations</h2>
            </div>
            <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
              Tailored to your interests
            </span>
          </div>

          {recommended.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-cyan-200 bg-cyan-50/40 py-12 text-center text-cyan-900">
              <Sparkles className="mx-auto mb-3 h-10 w-10 opacity-70" />
              <p className="text-lg font-semibold">No matching recommendations right now</p>
              <p className="mt-1 text-sm text-cyan-800/80">
                We will show events when categories matching your selected interests are approved.
              </p>
            </div>
          ) : (
            <motion.div
              variants={gridVariants}
              initial="hidden"
              animate="show"
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {recommended.map((event) => (
                <motion.div key={`rec-${event._id}`} variants={cardVariants}>
                  <EventCard event={event} showAiReason={true} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </section>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <TabsList className="h-auto w-full rounded-2xl border border-slate-200 bg-white/80 p-1.5 shadow-sm backdrop-blur-sm sm:w-auto">
              <TabsTrigger value="explore" className="gap-2 rounded-xl px-4 py-2 data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                <Search className="h-4 w-4" /> Explore
              </TabsTrigger>
              <TabsTrigger value="interested" className="gap-2 rounded-xl px-4 py-2 data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                <Heart className="h-4 w-4" /> Interested
              </TabsTrigger>
              <TabsTrigger value="registered" className="gap-2 rounded-xl px-4 py-2 data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                <Ticket className="h-4 w-4" /> Registered
              </TabsTrigger>
              <TabsTrigger value="contact" className="gap-2 rounded-xl px-4 py-2 data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                <Phone className="h-4 w-4" /> Contact
              </TabsTrigger>
            </TabsList>

            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 backdrop-blur-sm">
              <Compass className="h-3.5 w-3.5 text-cyan-600" />
              Curated for {session.user.department || "your campus"}
            </div>
          </div>

          <TabsContent value="explore" className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm backdrop-blur-sm">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search by title, venue, or organizer"
                    className="border-slate-200 bg-white pl-10"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full border-slate-200 bg-white sm:w-[240px]">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categoryOptions.map((tag) => (
                      <SelectItem key={tag} value={tag}>
                        {tag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filteredEvents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 py-16 text-center text-slate-600">
                <Search className="mx-auto mb-3 h-12 w-12 opacity-40" />
                <p className="text-lg font-semibold text-slate-800">No events found</p>
                <p className="mt-1 text-sm">
                  {allEvents.length === 0 && !search && categoryFilter === "all"
                    ? "No approved upcoming events yet. Ask HOD to recommend and Admin to approve events."
                    : "Try another category or a broader search keyword."}
                </p>
              </div>
            ) : (
              <motion.div
                variants={gridVariants}
                initial="hidden"
                animate="show"
                className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
              >
                {filteredEvents.map((event) => (
                  <motion.div key={event._id} variants={cardVariants}>
                    <EventCard event={event} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="interested" className="space-y-4">
            {interestedEvents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 py-16 text-center text-slate-600">
                <Heart className="mx-auto mb-3 h-12 w-12 opacity-40" />
                <p className="text-lg font-semibold text-slate-800">No interested events yet</p>
                <p className="mt-1 text-sm">Mark events as interested to build your personal lineup.</p>
              </div>
            ) : (
              <motion.div
                variants={gridVariants}
                initial="hidden"
                animate="show"
                className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
              >
                {interestedEvents.map((event) => (
                  <motion.div key={`interest-${event._id}`} variants={cardVariants}>
                    <EventCard event={event} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="registered" className="space-y-4">
            {myRegistrations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 py-16 text-center text-slate-600">
                <Ticket className="mx-auto mb-3 h-12 w-12 opacity-40" />
                <p className="text-lg font-semibold text-slate-800">No registrations yet</p>
                <p className="mt-1 text-sm">Register for events to collect your tickets here.</p>
              </div>
            ) : (
              <motion.div
                variants={gridVariants}
                initial="hidden"
                animate="show"
                className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
              >
                {myRegistrations.map((event) => (
                  <motion.div key={`reg-${event._id}`} variants={cardVariants}>
                    <EventCard event={event} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="contact" className="space-y-4">
            <Card className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-bold tracking-tight text-slate-900">
                  Event Helpline & Contact Details
                </CardTitle>
                <p className="text-sm text-slate-600">
                  Event registration, cancellation, or support साठी खालील details वर संपर्क करा.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="mb-2 flex items-center gap-2 text-slate-700">
                      <Phone className="h-4 w-4 text-cyan-700" />
                      <span className="text-xs font-semibold uppercase">Mobile</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{contactInfo.phone}</p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="mb-2 flex items-center gap-2 text-slate-700">
                      <Mail className="h-4 w-4 text-cyan-700" />
                      <span className="text-xs font-semibold uppercase">Email</span>
                    </div>
                    <p className="break-all text-sm font-semibold text-slate-900">{contactInfo.email}</p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="mb-2 flex items-center gap-2 text-slate-700">
                      <MapPin className="h-4 w-4 text-cyan-700" />
                      <span className="text-xs font-semibold uppercase">Address</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{contactInfo.address}</p>
                  </div>
                </div>

                {contactInfo.updatedAt && (
                  <p className="text-xs text-slate-500">
                    Last updated: {new Date(contactInfo.updatedAt).toLocaleString("en-IN")}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={eventDetailsOpen} onOpenChange={setEventDetailsOpen}>
          <DialogContent className="max-h-[88vh] overflow-y-auto border-slate-200 p-0 sm:max-w-2xl">
            {selectedEvent && (
              <div className="overflow-hidden rounded-2xl">
                <div className={cn("relative h-56 overflow-hidden bg-gradient-to-br", getCategoryTheme(selectedEvent.category).banner)}>
                  {selectedEvent.bannerUrl && (
                    <Image
                      src={selectedEvent.bannerUrl}
                      alt={selectedEvent.title}
                      fill
                      className="object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-900/25 to-transparent" />
                  <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-2">
                    <Badge className={cn("border bg-white/85 text-slate-800", getCategoryTheme(selectedEvent.category).badge)}>
                      {selectedEvent.category}
                    </Badge>
                    <Badge variant="outline" className="border-white/70 bg-white/85 text-slate-900">
                      {isPastEvent(selectedEvent.date) ? "Closed" : selectedEvent.status}
                    </Badge>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-2xl font-black tracking-tight text-white">{selectedEvent.title}</h3>
                    <p className="mt-1 text-sm text-slate-100">{formatDateLabel(selectedEvent.date)} at {selectedEvent.venue}</p>
                  </div>
                </div>

                <div className="space-y-5 p-5">
                  <div>
                    <DialogHeader>
                      <DialogTitle>Event Details</DialogTitle>
                      <DialogDescription>
                        Complete event information for registration planning.
                      </DialogDescription>
                    </DialogHeader>
                    <p className="mt-3 text-sm leading-relaxed text-slate-700">{selectedEvent.description}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-700">
                      <p className="text-xs font-semibold uppercase text-slate-500">Organizer</p>
                      <p className="mt-1 font-medium">{selectedEvent.organizer?.name || "Organizer not assigned"}</p>
                      <p className="text-xs text-slate-500">{selectedEvent.organizer?.department || "Department unavailable"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-700">
                      <p className="text-xs font-semibold uppercase text-slate-500">Department</p>
                      <p className="mt-1 font-medium">{selectedEvent.department || "Open to all"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-700">
                      <p className="text-xs font-semibold uppercase text-slate-500">Capacity</p>
                      <p className="mt-1 font-medium">{selectedEventRegistrations} / {selectedEvent.capacity} filled</p>
                      <p className="text-xs text-slate-500">{selectedEventAvailableSeats} seats left</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-700">
                      <p className="text-xs font-semibold uppercase text-slate-500">Status</p>
                      <p className="mt-1 font-medium">{isPastEvent(selectedEvent.date) ? "Closed" : "Open for registration"}</p>
                    </div>
                  </div>

                  {selectedEvent.aiReason && (
                    <div className="flex items-start gap-2 rounded-xl border border-cyan-100 bg-cyan-50 p-3 text-sm text-cyan-800">
                      <Brain className="mt-0.5 h-4 w-4" />
                      <span>{selectedEvent.aiReason}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
      <StudentChatbot />
    </DashboardLayout>
  );
}
