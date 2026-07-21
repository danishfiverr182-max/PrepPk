/**
 * components/chat/ChatMessage.jsx  (Part 11   Prompt 5: feedback buttons)
 *
 * Renders a single chat bubble.
 *   - role: "user"   right-aligned, brand-colored background, plain text.
 *   - role: "assistant"  left-aligned, neutral surface background, rendered
 *     through a minimal regex-based markdown renderer (bold, bullet lists,
 *     numbered lists, inline code). No markdown library is added since the
 *     app doesn't already depend on one — dompurify (already a dependency)
 *     sanitizes the generated HTML before it's injected.
 *   - Non-error assistant replies get a thumbs-up/down row underneath,
 *     wired to POST /api/chat/feedback (only the first ~100 chars of the
 *     reply are ever sent, purely for context   see api/chat.js).
 *
 * Props:
 *   message: { id, role: "user" | "assistant", content: string, isError?: boolean }
 */

import DOMPurify from "dompurify";
import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { sendChatFeedback } from "../../api/chat";

// ── Minimal markdown → HTML ─────────────────────────────────────
// Deliberately small: only the subset the AI assistant is likely to use
// in exam-prep answers (bold, bullet/numbered lists, inline code).
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(line) {
  return line
    // inline code   `like this`
    .replace(/`([^`]+)`/g, "<code class=\"px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[0.85em] font-mono\">$1</code>")
    // bold   **like this**
    .replace(/\*\*([^*]+)\*\*/g, "<strong class=\"font-semibold\">$1</strong>");
}

function renderMarkdown(rawText) {
  const escaped = escapeHtml(rawText);
  const lines = escaped.split(/\r?\n/);

  const blocks = [];
  let listBuffer = [];
  let listType = null; // "ul" | "ol"

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const tag = listType === "ol" ? "ol" : "ul";
    const listClass =
      tag === "ol"
        ? "list-decimal list-inside space-y-1 my-1.5"
        : "list-disc list-inside space-y-1 my-1.5";
    const items = listBuffer.map((item) => `<li>${renderInline(item)}</li>`).join("");
    blocks.push(`<${tag} class="${listClass}">${items}</${tag}>`);
    listBuffer = [];
    listType = null;
  };

  for (const line of lines) {
    const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
    const numberedMatch = line.match(/^\s*\d+\.\s+(.*)$/);

    if (bulletMatch) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listBuffer.push(bulletMatch[1]);
      continue;
    }

    if (numberedMatch) {
      if (listType !== "ol") flushList();
      listType = "ol";
      listBuffer.push(numberedMatch[1]);
      continue;
    }

    flushList();

    if (line.trim().length === 0) {
      blocks.push("<br />");
    } else {
      blocks.push(`<p class="leading-relaxed">${renderInline(line)}</p>`);
    }
  }
  flushList();

  return DOMPurify.sanitize(blocks.join(""));
}

export default function ChatMessage({ message }) {
  const isUser = message.role === "user";
  const isError = Boolean(message.isError);

  // "up" | "down" | null   local to this bubble's lifetime, not persisted.
  // Losing the selected state on refresh is an acceptable tradeoff since
  // feedback is a lightweight, best-effort signal, not part of the
  // conversation itself.
  const [feedback, setFeedback] = useState(null);

  function handleFeedback(rating) {
    if (feedback === rating) return; // no-op, already selected
    setFeedback(rating); // optimistic   feedback is fire-and-forget
    sendChatFeedback(message.content, rating);
  }

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[85%] px-3.5 py-2.5 text-sm rounded-2xl ${
          isUser
            ? "bg-brand text-white rounded-br-md"
            : isError
            ? "bg-danger-light text-danger border border-danger/30 rounded-bl-md dark:bg-red-900/20 dark:text-red-300 dark:border-red-700/30"
            : "bg-bg text-txt-primary border border-border rounded-bl-md dark:bg-dark-surface2 dark:text-slate-100 dark:border-dark-border"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        ) : isError ? (
          <p className="leading-relaxed">{message.content}</p>
        ) : (
          <div
            className="chat-markdown [&>p]:m-0 [&_ul]:m-0 [&_ol]:m-0"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
          />
        )}
      </div>

      {/* ── Feedback row ─────────────────────────────────────
          Only on genuine assistant replies   not user bubbles, not
          inline error bubbles (rating an error message is meaningless). */}
      {!isUser && !isError && (
        <div className="flex items-center gap-1 mt-1 px-1">
          <button
            type="button"
            onClick={() => handleFeedback("up")}
            aria-label="Good response"
            aria-pressed={feedback === "up"}
            className={`p-1 rounded-md transition-colors ${
              feedback === "up"
                ? "text-success"
                : "text-txt-muted hover:text-txt-secondary dark:text-slate-600 dark:hover:text-slate-400"
            }`}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleFeedback("down")}
            aria-label="Poor response"
            aria-pressed={feedback === "down"}
            className={`p-1 rounded-md transition-colors ${
              feedback === "down"
                ? "text-danger"
                : "text-txt-muted hover:text-txt-secondary dark:text-slate-600 dark:hover:text-slate-400"
            }`}
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
