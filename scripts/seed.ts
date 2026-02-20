import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/Event_Management";

// Define schemas inline to avoid import issues with tsx
const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["student", "hod", "admin"],
      default: "student",
    },
    department: { type: String },
    interests: [{ type: String }],
    avatar: { type: String },
  },
  { timestamps: true }
);

const EventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
    venue: { type: String, required: true },
    category: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    bannerUrl: { type: String },
    registeredStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    capacity: { type: Number, required: true },
  },
  { timestamps: true }
);

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing data
    const User = mongoose.models.User || mongoose.model("User", UserSchema);
    const Event = mongoose.models.Event || mongoose.model("Event", EventSchema);

    await User.deleteMany({});
    await Event.deleteMany({});
    console.log("🗑️  Cleared existing data");

    const hashedPassword = await bcrypt.hash("admin123", 12);
    const studentPassword = await bcrypt.hash("student123", 12);
    const hodPassword = await bcrypt.hash("hod123", 12);

    // Create Admin
    const admin = await User.create({
      name: "Admin User",
      email: "admin@college.com",
      password: hashedPassword,
      role: "admin",
      department: "Administration",
    });
    console.log("👑 Admin created: admin@college.com / admin123");

    // Create HODs
    const hodCS = await User.create({
      name: "Dr. Priya Sharma",
      email: "hod.cs@college.com",
      password: hodPassword,
      role: "hod",
      department: "Computer Science",
    });

    const hodMech = await User.create({
      name: "Dr. Rajesh Kumar",
      email: "hod.mech@college.com",
      password: hodPassword,
      role: "hod",
      department: "Mechanical Engineering",
    });
    console.log("🎓 HODs created: hod.cs@college.com, hod.mech@college.com / hod123");

    // Create Students
    const studentData = [
      { name: "Aarav Patel", email: "aarav@student.com", interests: ["Coding", "Hackathon", "AI/ML"], department: "Computer Science" },
      { name: "Diya Singh", email: "diya@student.com", interests: ["Dance", "Cultural", "Music"], department: "Computer Science" },
      { name: "Vivaan Gupta", email: "vivaan@student.com", interests: ["Sports", "Robotics", "Workshop"], department: "Mechanical Engineering" },
      { name: "Ananya Reddy", email: "ananya@student.com", interests: ["Photography", "Art", "Cultural"], department: "Information Technology" },
      { name: "Arjun Nair", email: "arjun@student.com", interests: ["Coding", "Web Development", "Hackathon"], department: "Computer Science" },
      { name: "Ishita Joshi", email: "ishita@student.com", interests: ["Debate", "Quiz", "Literature"], department: "Electrical Engineering" },
      { name: "Kabir Mehta", email: "kabir@student.com", interests: ["Music", "Fest", "Networking"], department: "Civil Engineering" },
      { name: "Myra Kapoor", email: "myra@student.com", interests: ["Dance", "Sports", "Cultural"], department: "Electronics & Communication" },
      { name: "Reyansh Verma", email: "reyansh@student.com", interests: ["Coding", "AI/ML", "Robotics"], department: "Computer Science" },
      { name: "Saanvi Iyer", email: "saanvi@student.com", interests: ["Seminar", "Workshop", "Networking"], department: "Biotechnology" },
    ];

    const students = await User.insertMany(
      studentData.map((s) => ({
        ...s,
        password: studentPassword,
        role: "student",
      }))
    );
    console.log("🧑‍🎓 10 Students created (password: student123)");

    // Create Events
    const events = await Event.insertMany([
      {
        title: "Code Sprint 2026",
        description: "An intensive 24-hour coding competition where teams build innovative solutions. Prizes worth ₹50,000!",
        organizer: hodCS._id,
        date: new Date("2026-03-15"),
        venue: "CS Lab Complex, Block A",
        category: "Coding",
        status: "approved",
        bannerUrl: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800",
        registeredStudents: [students[0]._id, students[4]._id, students[8]._id],
        capacity: 100,
      },
      {
        title: "AI & Machine Learning Workshop",
        description: "A hands-on workshop covering neural networks, deep learning, and practical AI applications with Python.",
        organizer: hodCS._id,
        date: new Date("2026-03-22"),
        venue: "Seminar Hall 1",
        category: "AI/ML",
        status: "approved",
        bannerUrl: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800",
        registeredStudents: [students[0]._id, students[8]._id],
        capacity: 60,
      },
      {
        title: "Annual Cultural Fest - Rhythm 2026",
        description: "The biggest cultural extravaganza of the year featuring dance, music, drama, and art competitions.",
        organizer: hodMech._id,
        date: new Date("2026-04-05"),
        venue: "Main Auditorium",
        category: "Cultural",
        status: "approved",
        bannerUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800",
        registeredStudents: [students[1]._id, students[3]._id, students[6]._id, students[7]._id],
        capacity: 500,
      },
      {
        title: "Robotics Expo 2026",
        description: "Showcase your robotics projects and compete in the bot-wars championship. Open to all departments.",
        organizer: hodMech._id,
        date: new Date("2026-04-20"),
        venue: "Innovation Center, Block D",
        category: "Robotics",
        status: "pending",
        bannerUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800",
        registeredStudents: [],
        capacity: 80,
      },
      {
        title: "Industry Connect Seminar",
        description: "Top industry leaders share insights on career paths, emerging tech trends, and hiring expectations.",
        organizer: hodCS._id,
        date: new Date("2026-05-10"),
        venue: "Conference Hall, Admin Block",
        category: "Seminar",
        status: "pending",
        bannerUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800",
        registeredStudents: [],
        capacity: 200,
      },
    ]);
    console.log(`🎉 ${events.length} Events created (3 Approved, 2 Pending)`);

    console.log("\n✨ Seed completed successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Login Credentials:");
    console.log("  Admin:   admin@college.com     / admin123");
    console.log("  HOD CS:  hod.cs@college.com    / hod123");
    console.log("  HOD ME:  hod.mech@college.com  / hod123");
    console.log("  Student: aarav@student.com     / student123");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seed();
