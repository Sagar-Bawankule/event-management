import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Event from "@/models/Event";
import { auth } from "@/lib/auth";

// The GEMINI API KEY will be read from environment variables inside the POST handler

// In-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 10;
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

interface EventDoc {
  _id: unknown;
  title: string;
  description: string;
  date: Date | string;
  venue: string;
  category: string;
  department?: string;
  capacity: number;
  registeredStudents?: unknown[];
}

/**
 * SERVER-SIDE keyword filter — runs before Gemini even sees the data.
 * Matches the user's query words against real event fields.
 * Returns only matching events, or all events if no specific match.
 */
function filterEventsByQuery(events: EventDoc[], query: string): EventDoc[] {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

  const scored = events.map((e) => {
    const searchable = `${e.title} ${e.description} ${e.category} ${e.department || ""}`.toLowerCase();
    const score = words.filter((w) => searchable.includes(w)).length;
    return { event: e, score };
  });

  const topScore = Math.max(...scored.map((s) => s.score));

  // If at least one keyword matched, return only those that matched
  if (topScore > 0) {
    return scored.filter((s) => s.score === topScore).map((s) => s.event);
  }

  // No strong keyword match → return all events (general query)
  return events;
}

function formatEventsContext(events: EventDoc[]): string {
  if (events.length === 0) {
    return "NONE";
  }

  return events
    .map((e, i) => {
      const registrations = Array.isArray(e.registeredStudents) ? e.registeredStudents.length : 0;
      const available = e.capacity - registrations;
      const dateStr = new Date(e.date).toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      return `[EVENT ${i + 1}]
Title: ${e.title}
Category: ${e.category}
Department: ${e.department || "Open to All"}
Date: ${dateStr}
Venue: ${e.venue}
Seats: ${e.capacity} total | ${registrations} registered | ${available > 0 ? `${available} seats available` : "FULLY BOOKED"}
Description: ${e.description.slice(0, 200)}${e.description.length > 200 ? "..." : ""}`;
    })
    .join("\n\n---\n\n");
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "student") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!checkRateLimit(session.user.id)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment before sending another message." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { message, history } = body as {
      message: string;
      history: Array<{ role: "user" | "model"; parts: [{ text: string }] }>;
    };

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    if (message.trim().length > 500) {
      return NextResponse.json({ error: "Message is too long (max 500 characters)" }, { status: 400 });
    }

    // ── Fetch ONLY approved events from live DB ───────────────────────────
    await connectDB();
    const allApprovedEvents = await Event.find({ status: "approved" })
      .select("title description date venue category department capacity registeredStudents")
      .sort({ date: 1 })
      .lean() as EventDoc[];

    // Server-side pre-filter so Gemini only sees relevant events
    const relevantEvents = filterEventsByQuery(allApprovedEvents, message.trim());
    const eventsContext = formatEventsContext(relevantEvents);

    const totalCount = allApprovedEvents.length;
    const hasNoEvents = totalCount === 0;

    // ── Strict system prompt, zero hallucination ──────────────────────────
    const systemInstruction = `You are MeetBot, the official assistant for MeetMatch — a college event management platform.

=== LIVE DATABASE SNAPSHOT (fetched right now) ===
Total approved events in database: ${totalCount}
Events relevant to this query:

${eventsContext}

=== YOUR RULES — NO EXCEPTIONS ===
RULE 1: You MUST ONLY talk about events listed in the LIVE DATABASE SNAPSHOT above. Never use your training knowledge to describe events.
RULE 2: If the DATABASE SNAPSHOT shows "${hasNoEvents ? "NONE" : "events"}" but NONE match the user's query category, reply exactly: "There are currently no [category] events approved on the platform."
RULE 3: NEVER say phrases like "there might be", "typically", "usually", "you can check", "in general coding events..." — ONLY state what is in the snapshot.
RULE 4: If the user asks for coding / hackathon / cultural / sports events and NONE appear in the snapshot, say so clearly. Do NOT suggest anything outside the list.
RULE 5: Always show: Event Title, Category, Date, Venue, Available seats.
RULE 6: Today is ${new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.
RULE 7: Keep responses short and clear.`;

    const contents = [
      {
        role: "user",
        parts: [{ text: systemInstruction }],
      },
      {
        role: "model",
        parts: [
          {
            text: `Understood. I have access to ${totalCount} approved event(s) from the live database. I will ONLY answer based on this data. I will never invent events.`,
          },
        ],
      },
      ...(history || []).slice(-8),
      {
        role: "user",
        parts: [{ text: message.trim() }],
      },
    ];
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not set in environment variables");
      return NextResponse.json({ error: "Chat feature is temporarily unavailable." }, { status: 500 });
    }
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0,   // Fully deterministic — no creativity, no hallucination
          topK: 1,
          topP: 1,
          maxOutputTokens: 600,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        ],
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", errText);
      if (geminiRes.status === 429) {
        return NextResponse.json(
          { error: "AI is currently busy. Please try again in a few seconds." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Failed to get a response from AI. Please try again." },
        { status: 500 }
      );
    }

    const geminiData = await geminiRes.json();
    const reply =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I'm sorry, I couldn't generate a response. Please try again.";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chatbot API error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
