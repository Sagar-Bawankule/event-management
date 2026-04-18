function getApiKey() {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  ];

  for (const value of candidates) {
    if (!value) continue;
    const cleaned = value.trim().replace(/^['\"]|['\"]$/g, "");
    if (cleaned.length > 0) return cleaned;
  }

  return null;
}

async function test() {
  const dotenv = await import("dotenv");
  dotenv.config({ path: ".env.local" });

  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("Gemini API key not found. Set GEMINI_API_KEY in .env.local");
    process.exit(1);
  }

  const modelName = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "hi" }] }],
      generationConfig: {
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    }),
  });

  const text = await res.text();
  console.log("Status:", res.status);

  try {
    const parsed = JSON.parse(text);
    console.log(JSON.stringify(parsed, null, 2));
  } catch {
    console.log(text);
  }
}

test().catch((error) => {
  console.error("Gemini test failed:", error);
  process.exit(1);
});
