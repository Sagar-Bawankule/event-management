"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Eye,
  Users,
  XCircle,
} from "lucide-react";
import { Session } from "next-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toaster";
import {
  approveDepartmentEvent,
  createEvent,
  rejectDepartmentEvent,
} from "@/actions/hod";
import { INTEREST_TAGS } from "@/lib/constants";
import DashboardLayout from "@/components/DashboardLayout";

interface HodEvent {
  _id: string;
  title: string;
  description: string;
  date: string;
  venue: string;
  category: string;
  eventUrl?: string;
  status: "pending" | "approved" | "rejected";
  hodRecommendation?: "pending" | "recommended" | "not_recommended";
  department?: string;
  capacity: number;
  organizer?: {
    _id?: string;
    name?: string;
    email?: string;
    department?: string;
  };
  registeredStudents?: Array<{
    _id: string;
    name: string;
    email: string;
    department?: string;
  }>;
}

interface ParticipationSummary {
  _id: string;
  title: string;
  date: string;
  status: "pending" | "approved" | "rejected";
  capacity: number;
  registrationCount: number;
  fillRate: number;
}

interface HodDashboardClientProps {
  session: Session;
  events: HodEvent[];
  departmentEvents: HodEvent[];
  participationSummary: ParticipationSummary[];
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
  return "Pending Review";
}

export default function HodDashboardClient({
  session,
  events,
  departmentEvents,
  participationSummary,
}: HodDashboardClientProps) {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [viewingAttendance, setViewingAttendance] = useState<HodEvent | null>(null);

  const departmentName = session.user.department || "Department";

  const myPending = useMemo(() => events.filter((event) => event.status === "pending"), [events]);
  const departmentPending = useMemo(
    () => departmentEvents.filter((event) => event.status === "pending"),
    [departmentEvents]
  );

  const totalParticipation = useMemo(
    () => participationSummary.reduce((acc, item) => acc + item.registrationCount, 0),
    [participationSummary]
  );

  async function handleCreateEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    if (!selectedCategory) {
      toast({
        title: "Category required",
        description: "Please select an event category.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData(form);
    formData.set("category", selectedCategory);

    setLoading(true);
    let result: { success?: boolean; error?: string };

    try {
      result = await createEvent(formData);
    } catch {
      toast({
        title: "Error",
        description: "Could not submit event. Please try again.",
        variant: "destructive",
      });
      return;
    } finally {
      setLoading(false);
    }

    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      return;
    }

    form.reset();
    setCreateDialogOpen(false);
    setSelectedCategory("");
    toast({
      title: "Event created",
      description: "Department event submitted successfully.",
      variant: "success",
    });
    router.refresh();
  }

  async function handleApprove(eventId: string) {
    const result = await approveDepartmentEvent(eventId);
    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      return;
    }
    toast({
      title: "Recommended",
      description: "Event forwarded for admin final approval.",
      variant: "success",
    });
    router.refresh();
  }

  async function handleReject(eventId: string) {
    const result = await rejectDepartmentEvent(eventId);
    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: "Updated", description: "Event marked as not recommended" });
    router.refresh();
  }

  return (
    <DashboardLayout session={session} role="hod">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">HOD Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Manage {departmentName} events, recommendations, and participation.
            </p>
          </div>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <CalendarPlus className="mr-2 h-5 w-5" /> Create Department Event
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Department-Specific Event</DialogTitle>
                <DialogDescription>
                  The event will be tagged under {departmentName} and submitted for approval.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input value={departmentName} disabled readOnly />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Event Title</Label>
                  <Input id="title" name="title" placeholder="Department Tech Talk" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" placeholder="Event details" required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input id="date" name="date" type="date" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Capacity</Label>
                    <Input id="capacity" name="capacity" type="number" min={1} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="venue">Venue</Label>
                  <Input id="venue" name="venue" placeholder="Seminar Hall" required />
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {INTEREST_TAGS.map((tag) => (
                        <SelectItem key={tag} value={tag}>
                          {tag}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bannerUrl">Banner URL (optional)</Label>
                  <Input id="bannerUrl" name="bannerUrl" placeholder="https://..." />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eventUrl">Event Website URL (optional)</Label>
                  <Input
                    id="eventUrl"
                    name="eventUrl"
                    type="url"
                    placeholder="https://hackathon.example.com"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Submitting..." : "Submit Event"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">My Events</CardTitle>
              <Building2 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{events.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending (My)</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{myPending.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending (Department)</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-violet-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-violet-600">{departmentPending.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Student Participation</CardTitle>
              <Users className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{totalParticipation}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={searchParams.get("tab") || "approval"} className="space-y-4">
          <TabsContent value="approval">
            <Card>
              <CardHeader>
                <CardTitle>Department Recommendation Queue</CardTitle>
              </CardHeader>
              <CardContent>
                {departmentPending.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending department events.</p>
                ) : (
                  <div className="space-y-3">
                    {departmentPending.map((event) => (
                      <div key={event._id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-semibold">{event.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(event.date).toLocaleDateString()} | {event.venue} | Organizer: {event.organizer?.name || "N/A"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {event.category} | Capacity {event.capacity}
                          </p>
                          <div className="mt-2">
                            <Badge
                              variant={recommendationVariant(event.hodRecommendation || "pending")}
                            >
                              {recommendationLabel(event.hodRecommendation)}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {event.hodRecommendation !== "recommended" && (
                            <Button size="sm" onClick={() => handleApprove(event._id)}>
                              <CheckCircle2 className="mr-1 h-4 w-4" /> Recommend
                            </Button>
                          )}
                          {event.hodRecommendation !== "not_recommended" && (
                            <Button size="sm" variant="outline" onClick={() => handleReject(event._id)}>
                              <XCircle className="mr-1 h-4 w-4" /> Not Recommend
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events">
            <Card>
              <CardHeader>
                <CardTitle>Department Event Management</CardTitle>
              </CardHeader>
              <CardContent>
                {departmentEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No department events available.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 font-medium">Title</th>
                          <th className="text-left p-3 font-medium">Date</th>
                          <th className="text-left p-3 font-medium">Category</th>
                          <th className="text-left p-3 font-medium">Status</th>
                          <th className="text-left p-3 font-medium">HOD Recommendation</th>
                          <th className="text-left p-3 font-medium">Registrations</th>
                          <th className="text-left p-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {departmentEvents.map((event) => (
                          <tr key={event._id} className="border-b hover:bg-muted/20">
                            <td className="p-3 font-medium">{event.title}</td>
                            <td className="p-3">{new Date(event.date).toLocaleDateString()}</td>
                            <td className="p-3">{event.category}</td>
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
                            <td className="p-3">{event.registeredStudents?.length || 0} / {event.capacity}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                {event.status === "pending" && (
                                  <>
                                    {event.hodRecommendation !== "recommended" && (
                                      <Button size="sm" onClick={() => handleApprove(event._id)}>Recommend</Button>
                                    )}
                                    {event.hodRecommendation !== "not_recommended" && (
                                      <Button size="sm" variant="outline" onClick={() => handleReject(event._id)}>Not Recommend</Button>
                                    )}
                                  </>
                                )}
                                {event.status === "approved" && (
                                  <Button size="sm" variant="outline" onClick={() => setViewingAttendance(event)}>
                                    <Eye className="mr-1 h-4 w-4" /> Attendance
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="participation">
            <Card>
              <CardHeader>
                <CardTitle>Student Participation by Event</CardTitle>
              </CardHeader>
              <CardContent>
                {participationSummary.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No participation records yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 font-medium">Event</th>
                          <th className="text-left p-3 font-medium">Date</th>
                          <th className="text-left p-3 font-medium">Status</th>
                          <th className="text-left p-3 font-medium">Registrations</th>
                          <th className="text-left p-3 font-medium">Fill Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {participationSummary.map((item) => (
                          <tr key={item._id} className="border-b hover:bg-muted/20">
                            <td className="p-3 font-medium">{item.title}</td>
                            <td className="p-3">{new Date(item.date).toLocaleDateString()}</td>
                            <td className="p-3">
                              <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                            </td>
                            <td className="p-3">{item.registrationCount} / {item.capacity}</td>
                            <td className="p-3">{item.fillRate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={Boolean(viewingAttendance)} onOpenChange={() => setViewingAttendance(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Attendance: {viewingAttendance?.title}</DialogTitle>
              <DialogDescription>
                {(viewingAttendance?.registeredStudents || []).length} students registered
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {(viewingAttendance?.registeredStudents || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No students registered yet.</p>
              ) : (
                (viewingAttendance?.registeredStudents || []).map((student) => (
                  <div key={student._id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium text-sm">{student.name}</p>
                      <p className="text-xs text-muted-foreground">{student.email}</p>
                    </div>
                    <Badge variant="outline">{student.department || "N/A"}</Badge>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
