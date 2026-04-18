"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Ban,
  BarChart3,
  CalendarCheck,
  CalendarX,
  CheckCircle2,
  Download,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Session } from "next-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import {
  approveEvent,
  createUser,
  deleteEvent,
  deleteUser,
  rejectEvent,
  toggleUserBlock,
} from "@/actions/admin";
import { updateContactInfo } from "@/actions/contact";
import { DEPARTMENTS, INTEREST_TAGS } from "@/lib/constants";
import DashboardLayout from "@/components/DashboardLayout";
import AdminAnalyticsCharts from "@/components/AdminAnalyticsCharts";

type UserRole = "student" | "hod" | "admin";

interface AdminStats {
  totalUsers: number;
  totalStudents: number;
  totalHods: number;
  totalBlockedUsers: number;
  totalEvents: number;
  pendingEvents: number;
  approvedEvents: number;
  rejectedEvents: number;
  totalRegistrations: number;
  totalInterestedMarks: number;
  avgEventFillRate: number;
  engagementRate: number;
}

interface DashboardUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  interests?: string[];
  isBlocked?: boolean;
  createdAt: string;
}

interface DashboardEvent {
  _id: string;
  title: string;
  description: string;
  date: string;
  venue: string;
  category: string;
  department?: string;
  status: "pending" | "approved" | "rejected";
  hodRecommendation?: "pending" | "recommended" | "not_recommended";
  organizer?: {
    name?: string;
    email?: string;
    department?: string;
  };
  registeredStudents?: unknown[];
  interestedStudents?: unknown[];
  capacity: number;
  createdAt: string;
}

interface ContactDetails {
  phone: string;
  email: string;
  address: string;
  updatedAt?: string;
}

interface AdminDashboardClientProps {
  session: Session;
  stats: AdminStats;
  pendingEvents: DashboardEvent[];
  users: DashboardUser[];
  allEvents: DashboardEvent[];
  contactInfo: ContactDetails;
}

function statusVariant(status: string): "success" | "warning" | "destructive" {
  if (status === "approved") return "success";
  if (status === "pending") return "warning";
  return "destructive";
}

function recommendationVariant(
  recommendation: string
): "success" | "warning" | "destructive" {
  if (recommendation === "recommended") return "success";
  if (recommendation === "not_recommended") return "destructive";
  return "warning";
}

function recommendationLabel(recommendation?: string) {
  if (recommendation === "recommended") return "Recommended";
  if (recommendation === "not_recommended") return "Not Recommended";
  return "Pending HOD Review";
}

function roleBadgeClass(role: UserRole) {
  if (role === "admin") return "bg-violet-100 text-violet-700 border-violet-200";
  if (role === "hod") return "bg-blue-100 text-blue-700 border-blue-200";
  return "bg-green-100 text-green-700 border-green-200";
}

function convertToCsv(rows: Array<Record<string, string | number | boolean>>) {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);
  const escapeCell = (value: string | number | boolean) => {
    const normalized = String(value ?? "").replace(/"/g, '""');
    return `"${normalized}"`;
  };

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(",")),
  ].join("\n");
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number | boolean>>) {
  const csv = convertToCsv(rows);
  if (!csv) return;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.setAttribute("download", filename);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export default function AdminDashboardClient({
  session,
  stats,
  pendingEvents,
  users,
  allEvents,
  contactInfo,
}: AdminDashboardClientProps) {
  const { toast } = useToast();
  const router = useRouter();

  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>("student");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [contactPhone, setContactPhone] = useState(contactInfo.phone);
  const [contactEmail, setContactEmail] = useState(contactInfo.email);
  const [contactAddress, setContactAddress] = useState(contactInfo.address);
  const [contactUpdatedAt, setContactUpdatedAt] = useState(contactInfo.updatedAt);
  const [contactSaving, setContactSaving] = useState(false);

  const filteredUsers = useMemo(() => {
    const normalized = userSearch.trim().toLowerCase();
    if (!normalized) return users;

    return users.filter((user) =>
      `${user.name} ${user.email} ${user.role} ${user.department || ""}`
        .toLowerCase()
        .includes(normalized)
    );
  }, [users, userSearch]);

  const filteredEvents = useMemo(() => {
    const normalized = eventSearch.trim().toLowerCase();
    if (!normalized) return allEvents;

    return allEvents.filter((event) =>
      `${event.title} ${event.category} ${event.venue} ${event.department || ""} ${event.organizer?.name || ""}`
        .toLowerCase()
        .includes(normalized)
    );
  }, [allEvents, eventSearch]);

  const topEvents = useMemo(() => {
    return [...allEvents]
      .sort(
        (a, b) =>
          (b.registeredStudents?.length || 0) - (a.registeredStudents?.length || 0)
      )
      .slice(0, 5);
  }, [allEvents]);

  const departmentSummary = useMemo(() => {
    const counter = new Map<string, { events: number; registrations: number }>();

    allEvents.forEach((event) => {
      const key = event.department || event.organizer?.department || "Unassigned";
      const current = counter.get(key) || { events: 0, registrations: 0 };
      current.events += 1;
      current.registrations += event.registeredStudents?.length || 0;
      counter.set(key, current);
    });

    return Array.from(counter.entries())
      .map(([department, value]) => ({ department, ...value }))
      .sort((a, b) => b.events - a.events);
  }, [allEvents]);

  async function handleCreateUser(formData: FormData) {
    setLoading(true);
    formData.set("role", selectedRole);

    if (selectedDept) {
      formData.set("department", selectedDept);
    } else {
      formData.delete("department");
    }

    formData.delete("interests");
    if (selectedRole === "student") {
      selectedInterests.forEach((interest) => formData.append("interests", interest));
    }

    const result = await createUser(formData);
    setLoading(false);

    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      return;
    }

    toast({
      title: "User created",
      description: result.message || "New user has been added",
      variant: "success",
    });

    setCreateUserOpen(false);
    setSelectedRole("student");
    setSelectedDept("");
    setSelectedInterests([]);
    router.refresh();
  }

  async function handleApprove(eventId: string) {
    const result = await approveEvent(eventId);
    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: "Approved", description: "Event approved successfully", variant: "success" });
    router.refresh();
  }

  async function handleReject(eventId: string) {
    const result = await rejectEvent(eventId);
    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: "Rejected", description: "Event rejected" });
    router.refresh();
  }

  async function handleDeleteEvent(eventId: string) {
    if (!confirm("Delete this event permanently?")) return;

    const result = await deleteEvent(eventId);
    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted", description: "Event removed", variant: "success" });
    router.refresh();
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm("Delete this user account?")) return;

    const result = await deleteUser(userId);
    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted", description: "User removed", variant: "success" });
    router.refresh();
  }

  async function handleToggleBlock(user: DashboardUser) {
    const shouldBlock = !user.isBlocked;
    const result = await toggleUserBlock(user._id, shouldBlock);
    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      return;
    }
    toast({
      title: shouldBlock ? "User blocked" : "User unblocked",
      description: `${user.name} is now ${shouldBlock ? "blocked" : "active"}`,
      variant: "success",
    });
    router.refresh();
  }

  async function handleSaveContactInfo() {
    setContactSaving(true);
    const result = await updateContactInfo({
      phone: contactPhone,
      email: contactEmail,
      address: contactAddress,
    });
    setContactSaving(false);

    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      return;
    }

    if (result.contact) {
      setContactPhone(result.contact.phone);
      setContactEmail(result.contact.email);
      setContactAddress(result.contact.address);
      setContactUpdatedAt(result.contact.updatedAt);
    }

    toast({
      title: "Contact details updated",
      description: "Student helpline information has been saved.",
      variant: "success",
    });
    router.refresh();
  }

  function toggleInterest(tag: string) {
    setSelectedInterests((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  }

  function downloadUsersReport() {
    const rows = users.map((user) => ({
      Name: user.name,
      Email: user.email,
      Role: user.role,
      Department: user.department || "",
      Blocked: Boolean(user.isBlocked),
      Interests: (user.interests || []).join(" | "),
      JoinedAt: new Date(user.createdAt).toLocaleDateString(),
    }));
    downloadCsv("users-report.csv", rows);
  }

  function downloadEventsReport() {
    const rows = allEvents.map((event) => {
      const registrations = event.registeredStudents?.length || 0;
      const interested = event.interestedStudents?.length || 0;
      const fillRate = event.capacity > 0 ? ((registrations / event.capacity) * 100).toFixed(1) : "0";

      return {
        Title: event.title,
        Category: event.category,
        Department: event.department || event.organizer?.department || "",
        Date: new Date(event.date).toLocaleDateString(),
        Status: event.status,
        Organizer: event.organizer?.name || "",
        Capacity: event.capacity,
        Registrations: registrations,
        Interested: interested,
        FillRatePercent: Number(fillRate),
      };
    });

    downloadCsv("events-report.csv", rows);
  }

  function downloadSummaryReport() {
    const rows = [
      {
        TotalUsers: stats.totalUsers,
        TotalEvents: stats.totalEvents,
        TotalRegistrations: stats.totalRegistrations,
        TotalInterestedMarks: stats.totalInterestedMarks,
        AvgFillRatePercent: stats.avgEventFillRate,
        EngagementRatePercent: stats.engagementRate,
        PendingEvents: stats.pendingEvents,
        ApprovedEvents: stats.approvedEvents,
        RejectedEvents: stats.rejectedEvents,
      },
    ];

    downloadCsv("engagement-summary.csv", rows);
  }

  const kpiCards = [
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Total Events",
      value: stats.totalEvents,
      icon: CalendarCheck,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      title: "Total Registrations",
      value: stats.totalRegistrations,
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Blocked Users",
      value: stats.totalBlockedUsers,
      icon: Ban,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      title: "Avg Fill Rate",
      value: `${stats.avgEventFillRate}%`,
      icon: BarChart3,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      title: "Engagement Rate",
      value: `${stats.engagementRate}%`,
      icon: ShieldCheck,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
  ];

  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "analytics";

  return (
    <DashboardLayout session={session} role="admin">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Analytics, user administration, event operations, and reports in one place.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {kpiCards.map((kpi) => (
            <Card key={kpi.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {kpi.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${kpi.bg}`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{kpi.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={currentTab} className="space-y-4">
          <TabsContent value="analytics" className="space-y-4">
            <AdminAnalyticsCharts stats={stats} allEvents={allEvents} />
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>User Management</CardTitle>
                <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="mr-2 h-4 w-4" /> Add User
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Create User Account</DialogTitle>
                      <DialogDescription>
                        Create a student, HOD, or admin account.
                      </DialogDescription>
                    </DialogHeader>
                    <form action={handleCreateUser} className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="new-name">Name</Label>
                          <Input id="new-name" name="name" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-email">Email</Label>
                          <Input id="new-email" name="email" type="email" required />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>User Role</Label>
                          <Select
                            value={selectedRole}
                            onValueChange={(value) => {
                              const role = value as UserRole;
                              setSelectedRole(role);
                              if (role === "admin") {
                                setSelectedDept("");
                                setSelectedInterests([]);
                              }
                              if (role === "hod") {
                                setSelectedInterests([]);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="student">Student</SelectItem>
                              <SelectItem value="hod">HOD</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="new-password">Password</Label>
                          <Input id="new-password" name="password" defaultValue="user123" />
                        </div>
                      </div>

                      {(selectedRole === "student" || selectedRole === "hod") && (
                        <div className="space-y-2">
                          <Label>Department</Label>
                          <Select value={selectedDept} onValueChange={setSelectedDept}>
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
                      )}

                      {selectedRole === "student" && (
                        <div className="space-y-2">
                          <Label>Interests</Label>
                          <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto border rounded-md p-3">
                            {INTEREST_TAGS.map((tag) => (
                              <div key={tag} className="flex items-center gap-2">
                                <Checkbox
                                  id={`new-${tag}`}
                                  checked={selectedInterests.includes(tag)}
                                  onCheckedChange={() => toggleInterest(tag)}
                                />
                                <Label htmlFor={`new-${tag}`} className="text-xs">
                                  {tag}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <Button type="submit" disabled={loading} className="w-full">
                        {loading ? "Creating..." : "Create User"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>

              <CardContent className="space-y-4">
                <Input
                  placeholder="Search users by name, email, role, or department"
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                />

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Name</th>
                        <th className="text-left p-3 font-medium">Email</th>
                        <th className="text-left p-3 font-medium">Role</th>
                        <th className="text-left p-3 font-medium">Department</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr key={user._id} className="border-b hover:bg-muted/20">
                          <td className="p-3 font-medium">{user.name}</td>
                          <td className="p-3">{user.email}</td>
                          <td className="p-3">
                            <Badge variant="outline" className={roleBadgeClass(user.role)}>
                              {user.role.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="p-3">{user.department || "-"}</td>
                          <td className="p-3">
                            {user.isBlocked ? (
                              <Badge variant="destructive">Blocked</Badge>
                            ) : (
                              <Badge variant="success">Active</Badge>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {user.role !== "admin" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleToggleBlock(user)}
                                >
                                  {user.isBlocked ? "Unblock" : "Block"}
                                </Button>
                              )}
                              {user.role !== "admin" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDeleteUser(user._id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-4">
                  <span>All Events</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    Pending Queue: {pendingEvents.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Search events by title, department, organizer, category, or venue"
                  value={eventSearch}
                  onChange={(event) => setEventSearch(event.target.value)}
                />

                {filteredEvents.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <CalendarX className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>No events match your search</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 font-medium">Title</th>
                          <th className="text-left p-3 font-medium">Department</th>
                          <th className="text-left p-3 font-medium">Date</th>
                          <th className="text-left p-3 font-medium">Status</th>
                          <th className="text-left p-3 font-medium">HOD Recommendation</th>
                          <th className="text-left p-3 font-medium">Engagement</th>
                          <th className="text-left p-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEvents.map((event) => {
                          const registrations = event.registeredStudents?.length || 0;
                          const interested = event.interestedStudents?.length || 0;

                          return (
                            <tr key={event._id} className="border-b hover:bg-muted/20">
                              <td className="p-3">
                                <p className="font-medium">{event.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {event.organizer?.name || "Unknown organizer"}
                                </p>
                              </td>
                              <td className="p-3">{event.department || event.organizer?.department || "-"}</td>
                              <td className="p-3">{new Date(event.date).toLocaleDateString()}</td>
                              <td className="p-3">
                                <Badge variant={statusVariant(event.status)}>{event.status}</Badge>
                              </td>
                              <td className="p-3">
                                <Badge
                                  variant={recommendationVariant(event.hodRecommendation || "pending")}
                                >
                                  {recommendationLabel(event.hodRecommendation)}
                                </Badge>
                              </td>
                              <td className="p-3">
                                <div className="text-xs">
                                  <p>{registrations}/{event.capacity} registered</p>
                                  <p className="text-muted-foreground">{interested} interested</p>
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  {event.status === "pending" && event.hodRecommendation === "recommended" && (
                                    <Button size="sm" onClick={() => handleApprove(event._id)}>
                                      Approve
                                    </Button>
                                  )}
                                  {event.status === "pending" && event.hodRecommendation === "recommended" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleReject(event._id)}
                                    >
                                      Reject
                                    </Button>
                                  )}
                                  {event.status === "pending" && event.hodRecommendation !== "recommended" && (
                                    <span className="text-xs text-muted-foreground">
                                      Awaiting HOD recommendation
                                    </span>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleDeleteEvent(event._id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contact" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Student Helpline Contact Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contact-phone" className="flex items-center gap-2">
                      <Phone className="h-4 w-4" /> Mobile Number
                    </Label>
                    <Input
                      id="contact-phone"
                      value={contactPhone}
                      onChange={(event) => setContactPhone(event.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact-email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4" /> Contact Email
                    </Label>
                    <Input
                      id="contact-email"
                      type="email"
                      value={contactEmail}
                      onChange={(event) => setContactEmail(event.target.value)}
                      placeholder="events@college.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-address" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Office Address
                  </Label>
                  <Textarea
                    id="contact-address"
                    value={contactAddress}
                    onChange={(event) => setContactAddress(event.target.value)}
                    rows={4}
                    placeholder="Admin Office, Main Block, Campus Road"
                  />
                </div>

                {contactUpdatedAt && (
                  <p className="text-xs text-muted-foreground">
                    Last saved at: {new Date(contactUpdatedAt).toLocaleString("en-IN")}
                  </p>
                )}

                <Button onClick={handleSaveContactInfo} disabled={contactSaving}>
                  {contactSaving ? "Saving..." : "Save Contact Details"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Export Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" variant="outline" onClick={downloadUsersReport}>
                    <Download className="mr-2 h-4 w-4" /> Download CSV
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Export Events</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" variant="outline" onClick={downloadEventsReport}>
                    <Download className="mr-2 h-4 w-4" /> Download CSV
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Engagement Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" variant="outline" onClick={downloadSummaryReport}>
                    <Download className="mr-2 h-4 w-4" /> Download CSV
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top Events by Registrations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No event data available</p>
                    ) : (
                      topEvents.map((event, index) => (
                        <div key={event._id} className="flex items-center justify-between text-sm">
                          <span className="truncate pr-3">{index + 1}. {event.title}</span>
                          <span className="font-semibold">
                            {event.registeredStudents?.length || 0}/{event.capacity}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Department Event Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {departmentSummary.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No department data available</p>
                    ) : (
                      departmentSummary.map((item) => (
                        <div key={item.department} className="flex items-center justify-between text-sm">
                          <span className="truncate pr-3">{item.department}</span>
                          <span className="font-semibold">
                            {item.events} events / {item.registrations} regs
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
