"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AssistantMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type AssistantPayload = {
  answer?: string;
  error?: string;
  mode?: string;
  suggestions?: string[];
};

const promptCards = [
  {
    body: "Get the first 1-3 tickers to review and why they matter.",
    label: "Today first",
    question: "Which 3 tickers should I review first today, and what exact levels matter?",
  },
  {
    body: "Translate a score into entry, target, stop, and risk language.",
    label: "Explain a pick",
    question: "Explain the top-ranked ticker in beginner terms with entry, target, stop, and risk.",
  },
  {
    body: "Check current positions against target, stop, news, and countdown.",
    label: "Portfolio next",
    question: "Which portfolio position needs attention first and what should I review next?",
  },
];

const contextPills = [
  "Today's rankings",
  "Prediction outcomes",
  "Your portfolio",
  "Data freshness",
];

function messageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function splitAnswer(text: string) {
  return text
    .split(/\n{2,}|\n-\s+|\n\d+\.\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function compactAnswerPreview(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 92 ? `${clean.slice(0, 92)}...` : clean;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createSupabaseBrowserClient();
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  const token = data.session?.access_token;

  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function SwingFiAssistant({ enabled }: { enabled: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [answerMode, setAnswerMode] = useState<"fallback" | "openai" | "ready">("ready");
  const [suggestions, setSuggestions] = useState(promptCards.map((prompt) => prompt.question));
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text:
        "Ask me for a plain-English read on a ticker, today's top rankings, or your tracked portfolio. I will use SwingFi data only: scores, entry range, target, stop, current portfolio prices, headlines, and prediction outcomes.",
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [isOpen, messages, loading]);

  if (!enabled || !mounted) return null;

  async function askAssistant(question: string) {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || loading) return;

    setInput("");
    setLoading(true);
    setMessages((current) => [
      ...current,
      { id: messageId(), role: "user", text: cleanQuestion },
    ]);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/assistant/chat", {
        body: JSON.stringify({ message: cleanQuestion }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as AssistantPayload | null;

      if (!response.ok || !payload?.answer) {
        throw new Error(payload?.error ?? "Ask SwingFi could not answer right now.");
      }

      setMessages((current) => [
        ...current,
        { id: messageId(), role: "assistant", text: payload.answer ?? "" },
      ]);
      setAnswerMode(payload.mode === "fallback" ? "fallback" : "openai");
      if (payload.suggestions?.length) {
        setSuggestions(payload.suggestions.slice(0, 3));
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: messageId(),
          role: "assistant",
          text:
            error instanceof Error
              ? error.message
              : "Ask SwingFi could not answer right now.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label="Open Ask SwingFi research assistant"
        onClick={() => setIsOpen((current) => !current)}
        className={`fixed bottom-24 right-3 z-[90] items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-black shadow-[0_20px_58px_rgba(7,20,24,0.22)] transition sm:px-4 sm:py-3 md:bottom-5 md:right-5 ${
          isOpen ? "hidden" : "flex"
        } ${
          isOpen
            ? "border-line bg-white text-ink hover:border-pine"
            : "border-pine/25 bg-ink text-white hover:bg-pine hover:text-ink"
        }`}
      >
        <span className={`grid h-7 w-7 place-items-center rounded-xl text-xs ring-1 ${
          isOpen ? "bg-mint text-pine ring-pine/15" : "bg-white/12 text-lime ring-white/15"
        }`}>
          AI
        </span>
        <span className="hidden sm:inline">{isOpen ? "Hide assistant" : "Ask SwingFi"}</span>
        <span className="sm:hidden">{isOpen ? "Hide" : "Ask"}</span>
      </button>

      {isOpen ? (
        <div className="pointer-events-none fixed inset-x-2 bottom-24 z-[85] sm:inset-x-auto sm:right-4 md:bottom-20 md:right-5">
          <section
            aria-labelledby="swingfi-assistant-title"
            role="dialog"
            className="pointer-events-auto ml-auto flex h-[min(72vh,680px)] w-full max-w-xl flex-col overflow-hidden rounded-[24px] border border-line bg-white shadow-[0_30px_100px_rgba(7,20,24,0.25)] sm:w-[min(92vw,620px)] sm:rounded-[28px] md:h-[min(720px,calc(100vh-6rem))]"
          >
            <div className="bg-[linear-gradient(145deg,#071418,#0b3d3f)] p-4 text-white sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-2xl bg-lime text-sm font-black text-ink">
                      AI
                    </span>
                    <div>
                      <p className="text-xs font-black uppercase tracking-normal text-lime">
                        Research assistant
                      </p>
                      <h2 id="swingfi-assistant-title" className="text-2xl font-black tracking-normal">
                        Ask SwingFi
                      </h2>
                    </div>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-white/68">
                    Ask for exact symbols, scores, entry ranges, targets, stops, current
                    position context, and headline reads. Research only, not financial advice.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="min-h-10 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black text-white/72 hover:bg-white/15"
                >
                  Close
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {contextPills.map((pill) => (
                  <span
                    key={pill}
                    className="rounded-2xl border border-white/12 bg-white/8 px-3 py-2 text-center text-[11px] font-black text-white/72"
                  >
                    {pill}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-surface p-3 sm:p-4">
              {messages.length === 1 ? (
                <div className="mb-3 grid gap-2 sm:grid-cols-3">
                  {promptCards.map((prompt) => (
                    <button
                      key={prompt.question}
                      type="button"
                      onClick={() => void askAssistant(prompt.question)}
                      disabled={loading}
                      className="rounded-2xl border border-line bg-white p-3 text-left transition hover:border-pine/35 hover:shadow-soft disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      <span className="text-xs font-black uppercase tracking-normal text-pine">
                        {prompt.label}
                      </span>
                      <span className="mt-2 block text-xs font-semibold leading-5 text-ink/58">
                        {prompt.body}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-2xl border p-3 text-sm leading-6 shadow-[0_10px_28px_rgba(7,20,24,0.045)] ${
                      message.role === "user"
                        ? "ml-8 border-pine/25 bg-mint text-ink sm:ml-20"
                        : "mr-4 border-line bg-white text-ink/72 sm:mr-12"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-black uppercase tracking-normal text-ink/42">
                        {message.role === "user" ? "You" : "SwingFi AI"}
                      </p>
                      {message.role === "assistant" && message.id !== "welcome" ? (
                        <span className="rounded-full bg-surface px-2 py-1 text-[10px] font-black uppercase tracking-normal text-ink/38">
                          {answerMode === "fallback" ? "Built-in" : "Context aware"}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 grid gap-2">
                      {splitAnswer(message.text).map((part) => (
                        <p key={part} className="font-semibold">
                          {part}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
                {loading ? (
                  <div className="mr-12 rounded-2xl border border-line bg-white p-3 text-sm font-bold text-ink/58 sm:mr-24">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-pine" />
                      Reading today&apos;s rankings and portfolio context...
                    </div>
                    <div className="mt-3 grid gap-2">
                      <div className="skeleton h-3 w-5/6 rounded-full" />
                      <div className="skeleton h-3 w-2/3 rounded-full" />
                    </div>
                  </div>
                ) : null}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="border-t border-line bg-white p-3 sm:p-4">
              {messages.length > 1 ? (
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                  {suggestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => void askAssistant(question)}
                      disabled={loading}
                      title={question}
                      className="shrink-0 rounded-full border border-line bg-surface px-3 py-2 text-xs font-black text-ink/62 hover:border-pine hover:text-pine disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {compactAnswerPreview(question)}
                    </button>
                  ))}
                </div>
              ) : null}
              <form
                className="grid gap-2 sm:grid-cols-[1fr_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  void askAssistant(input);
                }}
              >
                <label className="sr-only" htmlFor="swingfi-assistant-question">
                  Ask SwingFi a question
                </label>
                <textarea
                  id="swingfi-assistant-question"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      event.preventDefault();
                      void askAssistant(input);
                    }
                  }}
                  placeholder="Ask about a ticker, score, stop, target, or portfolio position..."
                  rows={2}
                  className="min-h-14 resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink outline-none focus:border-pine focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={loading || input.trim().length < 3}
                  className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(7,20,24,0.16)] hover:bg-pine hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Thinking" : "Ask"}
                </button>
              </form>
              <p className="mt-2 text-xs font-semibold leading-5 text-ink/45">
                Better questions include a ticker or goal, like “explain AMZN” or
                “which position is closest to target?” SwingFi does not place trades.
              </p>
            </div>
          </section>
        </div>
      ) : null}
    </>,
    document.body,
  );
}
