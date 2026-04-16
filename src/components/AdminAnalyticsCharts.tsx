"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadialBarChart,
  RadialBar,
  AreaChart,
  Area,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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

interface DashboardEvent {
  _id: string;
  title: string;
  description: string;
  date: string;
  venue: string;
  category: string;
  department?: string;
  status: "pending" | "approved" | "rejected";
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

interface Props {
  stats: AdminStats;
  allEvents: DashboardEvent[];
}

const VIOLET = "#7c3aed";
const INDIGO = "#4f46e5";
const GREEN = "#16a34a";
const AMBER = "#d97706";
const RED = "#dc2626";
const BLUE = "#2563eb";
const PINK = "#db2777";
const CYAN = "#0891b2";

const STATUS_COLORS: Record<string, string> = {
  Approved: GREEN,
  Pending: AMBER,
  Rejected: RED,
};

const CATEGORY_COLORS = [VIOLET, INDIGO, BLUE, GREEN, AMBER, RED, PINK, CYAN];

// Custom Tooltip component
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 shadow-xl rounded-xl px-4 py-3 text-xs">
      {label && <p className="font-semibold text-gray-700 mb-1">{label}</p>}
      {payload.map((item) => (
        <p key={item.name} style={{ color: item.color }} className="font-medium">
          {item.name}: <span className="font-bold">{item.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function AdminAnalyticsCharts({ stats, allEvents }: Props) {
  // ── Data preparation ──────────────────────────────────────────────────────

  // 1. User distribution (Pie)
  const userPieData = [
    { name: "Students", value: stats.totalStudents, color: GREEN },
    { name: "HODs", value: stats.totalHods, color: BLUE },
    { name: "Blocked", value: stats.totalBlockedUsers, color: RED },
  ].filter((d) => d.value > 0);

  // 2. Event status (Pie)
  const eventStatusData = [
    { name: "Approved", value: stats.approvedEvents, color: GREEN },
    { name: "Pending", value: stats.pendingEvents, color: AMBER },
    { name: "Rejected", value: stats.rejectedEvents, color: RED },
  ].filter((d) => d.value > 0);

  // 3. Category distribution (Bar) — count events per category
  const categoryMap: Record<string, { events: number; registrations: number }> = {};
  allEvents.forEach((e) => {
    const cat = e.category || "Other";
    if (!categoryMap[cat]) categoryMap[cat] = { events: 0, registrations: 0 };
    categoryMap[cat].events += 1;
    categoryMap[cat].registrations += e.registeredStudents?.length || 0;
  });
  const categoryData = Object.entries(categoryMap)
    .map(([name, val]) => ({ name, ...val }))
    .sort((a, b) => b.events - a.events)
    .slice(0, 8);

  // 4. Department bar chart
  const deptMap: Record<string, { events: number; registrations: number }> = {};
  allEvents.forEach((e) => {
    const dept = e.department || e.organizer?.department || "Unassigned";
    if (!deptMap[dept]) deptMap[dept] = { events: 0, registrations: 0 };
    deptMap[dept].events += 1;
    deptMap[dept].registrations += e.registeredStudents?.length || 0;
  });
  const deptData = Object.entries(deptMap)
    .map(([name, val]) => ({ name: name.length > 18 ? name.slice(0, 16) + "…" : name, ...val }))
    .sort((a, b) => b.registrations - a.registrations)
    .slice(0, 8);

  // 5. Top 6 events by fill rate (Radial)
  const topEventsFillRate = [...allEvents]
    .filter((e) => e.status === "approved" && e.capacity > 0)
    .map((e) => ({
      name: e.title.length > 22 ? e.title.slice(0, 20) + "…" : e.title,
      fillRate: Math.round(((e.registeredStudents?.length || 0) / e.capacity) * 100),
      registered: e.registeredStudents?.length || 0,
      capacity: e.capacity,
      fill: VIOLET,
    }))
    .sort((a, b) => b.fillRate - a.fillRate)
    .slice(0, 6);

  // 6. Timeline — events by month from createdAt
  const monthMap: Record<string, number> = {};
  allEvents.forEach((e) => {
    const month = new Date(e.createdAt).toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
    });
    monthMap[month] = (monthMap[month] || 0) + 1;
  });
  const timelineData = Object.entries(monthMap)
    .map(([month, count]) => ({ month, events: count }))
    .slice(-8);

  // 7. Engagement radial (fill rate, engagement)
  const engagementData = [
    { name: "Fill Rate", value: stats.avgEventFillRate, fill: VIOLET },
    { name: "Engagement", value: stats.engagementRate, fill: INDIGO },
  ];

  return (
    <div className="space-y-6">

      {/* Row 1: Two Pie Charts */}
      <div className="grid gap-5 md:grid-cols-2">

        {/* User Distribution */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">User Distribution</CardTitle>
            <CardDescription>Breakdown by role across the platform</CardDescription>
          </CardHeader>
          <CardContent>
            {userPieData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No user data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={userPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {userPieData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={10}
                    formatter={(value) => (
                      <span className="text-xs text-gray-600">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Event Status */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Event Status Overview</CardTitle>
            <CardDescription>Approved, pending, and rejected events</CardDescription>
          </CardHeader>
          <CardContent>
            {eventStatusData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No events yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={eventStatusData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {eventStatusData.map((entry, idx) => (
                      <Cell key={idx} fill={STATUS_COLORS[entry.name] || VIOLET} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={10}
                    formatter={(value) => (
                      <span className="text-xs text-gray-600">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Event Timeline Area Chart */}
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Event Creation Timeline</CardTitle>
          <CardDescription>Number of events created per month</CardDescription>
        </CardHeader>
        <CardContent>
          {timelineData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No timeline data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={timelineData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={VIOLET} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={VIOLET} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="events"
                  name="Events Created"
                  stroke={VIOLET}
                  strokeWidth={2.5}
                  fill="url(#areaGradient)"
                  dot={{ fill: VIOLET, r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Row 3: Category Bar Chart */}
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Events & Registrations by Category</CardTitle>
          <CardDescription>Which event types are most popular</CardDescription>
        </CardHeader>
        <CardContent>
          {categoryData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No category data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={categoryData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="square"
                  iconSize={10}
                  formatter={(value) => (
                    <span className="text-xs text-gray-600">{value}</span>
                  )}
                />
                <Bar dataKey="events" name="Events" fill={VIOLET} radius={[4, 4, 0, 0]} />
                <Bar dataKey="registrations" name="Registrations" fill={INDIGO} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Row 4: Department Bar + Engagement Radial */}
      <div className="grid gap-5 md:grid-cols-2">

        {/* Department Chart */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Department Engagement</CardTitle>
            <CardDescription>Events and registrations per department</CardDescription>
          </CardHeader>
          <CardContent>
            {deptData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No department data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={deptData}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} allowDecimals={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={110}
                    tick={{ fontSize: 10, fill: "#6b7280" }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    iconType="square"
                    iconSize={10}
                    formatter={(value) => (
                      <span className="text-xs text-gray-600">{value}</span>
                    )}
                  />
                  <Bar dataKey="events" name="Events" fill={BLUE} radius={[0, 4, 4, 0]} barSize={10} />
                  <Bar dataKey="registrations" name="Registrations" fill={GREEN} radius={[0, 4, 4, 0]} barSize={10} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Engagement Radial */}
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Platform Engagement Rates</CardTitle>
            <CardDescription>Avg seat fill rate and student engagement</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={200}>
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="30%"
                outerRadius="90%"
                data={engagementData}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar
                  dataKey="value"
                  cornerRadius={8}
                  label={{ position: "insideStart", fill: "#fff", fontSize: 12, fontWeight: 700 }}
                />
                <Legend
                  iconSize={10}
                  formatter={(value) => (
                    <span className="text-xs text-gray-600">{value}</span>
                  )}
                />
                <Tooltip
                  formatter={(value) => [`${value}%`, ""]}
                  content={<CustomTooltip />}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="flex gap-6 mt-2">
              <div className="text-center">
                <p className="text-2xl font-bold" style={{ color: VIOLET }}>
                  {stats.avgEventFillRate}%
                </p>
                <p className="text-xs text-muted-foreground">Avg Fill Rate</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold" style={{ color: INDIGO }}>
                  {stats.engagementRate}%
                </p>
                <p className="text-xs text-muted-foreground">Engagement</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 5: Top events fill rate bar chart */}
      {topEventsFillRate.length > 0 && (
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Top Events by Seat Fill Rate</CardTitle>
            <CardDescription>Approved events ranked by occupancy percentage</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={topEventsFillRate}
                margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  domain={[0, 100]}
                  unit="%"
                />
                <Tooltip
                  content={<CustomTooltip />}
                  formatter={(value, name) => [`${value}%`, name]}
                />
                <Bar dataKey="fillRate" name="Fill Rate" radius={[4, 4, 0, 0]}>
                  {topEventsFillRate.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.fillRate >= 80 ? RED : entry.fillRate >= 50 ? AMBER : VIOLET}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 justify-center text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: RED }} /> ≥80% Full
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: AMBER }} /> 50–79%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: VIOLET }} /> &lt;50%
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
