import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Event from "@/models/Event";
import { auth } from "@/lib/auth";

// The GEMINI API KEY will be read from environment variables inside the POST handler

const STOP_WORDS = new Set([
  "about",
  "tell",
  "show",
  "what",
  "which",
  "when",
  "where",
  "from",
  "with",
  "this",
  "that",
  "event",
  "events",
  "please",
  "want",
  "need",
  "give",
  "details",
  "particular",
  "specific",
  "today",
  "tomorrow",
]);

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

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractEventNameHints(query: string): string[] {
  const hints = new Set<string>();

  for (const match of query.matchAll(/"([^\"]+)"/g)) {
    const value = match[1]?.trim();
    if (value && value.length > 2) hints.add(value);
  }

  const triggerPatterns = [
    /tell me about\s+(.+)/i,
    /about\s+(.+)/i,
    /details of\s+(.+)/i,
    /information on\s+(.+)/i,
    /info on\s+(.+)/i,
  ];

  for (const pattern of triggerPatterns) {
    const match = query.match(pattern);
    if (match?.[1]) {
      const candidate = match[1].replace(/[?!.]+$/g, "").trim();
      if (candidate.length > 2) hints.add(candidate);
    }
  }

  return Array.from(hints);
}

function resolveGeminiApiKey(): string | null {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  ];

  for (const rawValue of candidates) {
    if (!rawValue) continue;
    const cleaned = rawValue.trim().replace(/^['\"]|['\"]$/g, "");
    if (cleaned.length > 0) return cleaned;
  }

  return null;
}

/**
 * SERVER-SIDE keyword filter — runs before Gemini even sees the data.
 * Matches the user's query words against real event fields.
 * Returns only matching events, or all events if no specific match.
 */
function filterEventsByQuery(events: EventDoc[], query: string): EventDoc[] {
  if (events.length === 0) return [];

  const normalizedQuery = normalizeText(query);
  const words = normalizedQuery
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  const eventNameHints = extractEventNameHints(query).map((item) => normalizeText(item));

  const scored = events.map((e) => {
    const title = normalizeText(e.title);
    const searchable = normalizeText(
      `${e.title} ${e.description} ${e.category} ${e.department || ""}`
    );

    let score = words.filter((w) => searchable.includes(w)).length;

    for (const hint of eventNameHints) {
      if (!hint) continue;

      if (title === hint) {
        score += 100;
      } else if (title.includes(hint) || hint.includes(title)) {
        score += 60;
      } else if (searchable.includes(hint)) {
        score += 30;
      }
    }

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
    const contextEvents = relevantEvents.slice(0, 25);
    const eventsContext = formatEventsContext(contextEvents);

    const totalCount = allApprovedEvents.length;

    // ── Strict system prompt, zero hallucination ──────────────────────────
    const systemInstruction = `You are MeetBot, the official assistant for MeetMatch — a college event management platform.

=== LIVE DATABASE SNAPSHOT (fetched right now) ===
Total approved events in database: ${totalCount}
Events relevant to this query:

${eventsContext}

=== YOUR RULES — NO EXCEPTIONS ===
RULE 1: You MUST ONLY talk about events listed in the LIVE DATABASE SNAPSHOT above. Never use your training knowledge to describe events.
RULE 2: If events do not match the user's requested category/type, reply exactly in this format: "There are currently no <requested-category> events approved on the platform."
RULE 3: NEVER say phrases like "there might be", "typically", "usually", "you can check", "in general coding events..." — ONLY state what is in the snapshot.
RULE 4: If the user asks for coding / hackathon / cultural / sports events and NONE appear in the snapshot, say so clearly. Do NOT suggest anything outside the list.
RULE 5: Always show: Event Title, Category, Date, Venue, Available seats.
RULE 6: Today is ${new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.
RULE 7: If the user asks for one specific event (example: "tell me about <event-name>"), provide details only for the best matching event title from snapshot.
RULE 8: Keep responses short and clear.`;

    const contents = [
      {
        role: "user",
        parts: [{ text: systemInstruction }],
      },
      {
        role: "model",
        parts: [
          {
            text: `Understood. I have access to ${totalCount} approved event(s) from the live database (showing ${contextEvents.length} most relevant event(s) for this query). I will ONLY answer based on this data. I will never invent events.`,
          },
        ],
      },
      ...(history || []).slice(-8),
      {
        role: "user",
        parts: [{ text: message.trim() }],
      },
    ];
    const apiKey = resolveGeminiApiKey();
    if (!apiKey) {
      console.error("Gemini API key is not set in environment variables");
      return NextResponse.json({ error: "Chat feature is temporarily unavailable." }, { status: 500 });
    }
    const modelName = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${apiKey}`;

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
          thinkingConfig: {
            thinkingBudget: 0,
          },
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
      let providerMessage = "";
      try {
        const parsed = JSON.parse(errText);
        providerMessage = parsed?.error?.message || "";
      } catch {
        providerMessage = "";
      }

      if (geminiRes.status === 429) {
        return NextResponse.json(
          { error: "AI is currently busy or quota is exhausted. Please try again in a few seconds." },
          { status: 429 }
        );
      }

      if (geminiRes.status === 401 || geminiRes.status === 403) {
        return NextResponse.json(
          { error: "Gemini API key is invalid or missing required access." },
          { status: 500 }
        );
      }

      if (geminiRes.status === 404) {
        return NextResponse.json(
          { error: `Gemini model \"${modelName}\" is not available for this API key/project.` },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          error:
            providerMessage ||
            "Failed to get a response from AI. Please try again.",
        },
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
