"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, X, Send, Minimize2, Sparkles, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: Date;
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "model",
  text: "Hey! 👋 I'm **MeetBot**, your AI assistant for MeetMatch.\n\nI can help you:\n- 🔍 Find upcoming events\n- 📅 Check event dates, venues & availability\n- 💡 Suggest events based on your interests\n\nWhat would you like to know?",
  timestamp: new Date(),
};

function formatText(text: string) {
  // Bold text
  let formatted = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Bullet points
  formatted = formatted.replace(/^- (.+)$/gm, "• $1");
  // Line breaks
  formatted = formatted.replace(/\n/g, "<br/>");
  return formatted;
}

export default function StudentChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unread, setUnread] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
      setUnread(0);
    }
  }, [messages, isOpen, isMinimized]);

  function openChat() {
    setIsOpen(true);
    setIsMinimized(false);
    setUnread(0);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError("");

    // Build history for API (exclude welcome)
    const history = messages
      .filter((m) => m.id !== "welcome")
      .map((m) => ({
        role: m.role as "user" | "model",
        parts: [{ text: m.text }],
      }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Something went wrong. Please try again.");
      } else {
        const botMsg: Message = {
          id: crypto.randomUUID(),
          role: "model",
          text: data.reply,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMsg]);

        if (isMinimized || !isOpen) {
          setUnread((n) => n + 1);
        }
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      {/* Floating chat button */}
      {(!isOpen || isMinimized) && (
        <button
          onClick={openChat}
          className="fixed bottom-6 right-6 z-50 group flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95"
          style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
          aria-label="Open MeetBot"
        >
          <Bot className="h-7 w-7 text-white group-hover:scale-95 transition-transform" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold animate-bounce">
              {unread}
            </span>
          )}
          {/* Pulse ring */}
          <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-violet-500" />
        </button>
      )}

      {/* Chat window */}
      {isOpen && !isMinimized && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col w-[360px] h-[520px] rounded-2xl shadow-2xl overflow-hidden border border-violet-100"
          style={{ background: "#0f0f1a" }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 shrink-0"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            }}
          >
            <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-white/20">
              <Bot className="h-5 w-5 text-white" />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-violet-600" />
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm leading-none">MeetBot</p>
              <p className="text-violet-200 text-xs mt-0.5">Powered by Gemini 2.5 Flash</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white/80 hover:text-white"
                aria-label="Minimize"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white/80 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                {msg.role === "model" && (
                  <div className="flex items-end shrink-0">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-white" />
                    </div>
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "rounded-br-sm text-white"
                      : "rounded-bl-sm text-gray-100"
                  )}
                  style={
                    msg.role === "user"
                      ? { background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }
                      : { background: "#1e1e2e", border: "1px solid #2e2e4e" }
                  }
                >
                  <p
                    dangerouslySetInnerHTML={{ __html: formatText(msg.text) }}
                    className="whitespace-pre-wrap"
                  />
                  <p className="text-[10px] mt-1 opacity-50 text-right">
                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex gap-2 justify-start">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
                >
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                <div
                  className="rounded-2xl rounded-bl-sm px-4 py-3"
                  style={{ background: "#1e1e2e", border: "1px solid #2e2e4e" }}
                >
                  <div className="flex gap-1.5 items-center">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-2 h-2 rounded-full bg-violet-400 animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mx-2 px-3 py-2 rounded-lg bg-red-900/30 border border-red-800/50 text-red-300 text-xs">
                ⚠️ {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested prompts */}
          {messages.length === 1 && (
            <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-none">
              {["Show coding events", "What's happening this week?", "Any cultural events?"].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setInput(prompt);
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }}
                  className="shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap"
                  style={{ borderColor: "#3e3e5e", background: "#1e1e2e", color: "#a78bfa" }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div
            className="flex items-center gap-2 px-3 py-3 border-t shrink-0"
            style={{ borderColor: "#2e2e4e", background: "#13131f" }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about events..."
              maxLength={500}
              disabled={loading}
              className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none disabled:opacity-50"
            />
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="h-8 w-8 shrink-0 rounded-full disabled:opacity-40 transition-all"
              style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
            >
              <Send className="h-3.5 w-3.5 text-white" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
