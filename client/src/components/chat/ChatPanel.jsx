/**
 * components/chat/ChatPanel.jsx  (Part 11   Prompt 5 polish pass;
 * MODIFIED — chatbot premium-gating)
 *
 * The chat panel body, rendered inside ChatWidget's floating/full-screen
 * container. Purely presentational + local input state   message state,
 * sending, and the real Groq-backed reply all live in ChatContext and
 * arrive here as props via ChatWidget.
 *
 * Props:
 *   messages:   Array<{ id, role: "user" | "assistant", content: string, isError?: boolean }>
 *   isLoading:  boolean   true while waiting for the assistant's reply
 *   onSend:     (text: string) => void
 *   onClose:    () => void
 *   onClear:    () => void   resets the conversation (Prompt 5)
 *   context:    { categoryName?: string, testName?: string } | null
 *   premiumUser:            the PremiumUser object from AuthContext, or
 *                            null/undefined for guests. Read fresh on every
 *                            render (not cached) so the locked state clears
 *                            immediately the moment a guest logs in   see
 *                            `isLocked` below.
 *   remainingFreeMessages:  number   guest-only free-message counter.
 *                            Ignored entirely when premiumUser is truthy.
 *   guestLimitReached:      boolean   true once a guest's 5 free messages
 *                            are used up.
 *   onLoginWithPremium:     () => void   "Login with Premium" button in
 *                            the locked state.
 *   onBuyPremium:           () => void   "Don't have Premium? Buy access"
 *                            link in the locked state.
 */

import { useEffect, useRef, useState } from "react";
import { X, Send, Sparkles, Trash2, Lock } from "lucide-react";
import ChatMessage from "./ChatMessage.jsx";

const MAX_MESSAGE_LENGTH = 2000;
const CHAR_WARNING_THRESHOLD = 1800; // ~90% of the limit

function buildSuggestedPrompts(context) {
  const categoryLabel = context?.categoryName || "your current topic";

  return [
    "Explain this MCQ topic",
    `Give me 5 practice questions on ${categoryLabel}`,
    "Tips for ISSB test",
    "What should I study today?",
  ];
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-bg border border-border rounded-2xl rounded-bl-md px-4 py-3 dark:bg-dark-surface2 dark:border-dark-border">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-txt-muted animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-txt-muted animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-txt-muted animate-bounce" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ context, onPromptClick }) {
  const prompts = buildSuggestedPrompts(context);

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-8 text-center overflow-y-auto">
      <div className="w-12 h-12 rounded-full bg-brand-light dark:bg-brand/20 flex items-center justify-center mb-3">
        <Sparkles className="w-6 h-6 text-brand" />
      </div>
      <h3 className="font-heading font-semibold text-txt-primary dark:text-slate-100 mb-1">
        Hi! I'm your PrepPk AI Assistant
      </h3>
      <p className="text-sm text-txt-secondary dark:text-slate-400 mb-5 max-w-xs">
        Ask me anything about verbal, non-verbal, academic MCQs, ISSB prep, or general exam
        strategy.
      </p>

      <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPromptClick(prompt)}
            className="text-left text-sm px-3.5 py-2.5 rounded-xl border border-border bg-surface hover:bg-bg hover:border-brand/40 text-txt-primary transition-colors dark:bg-dark-surface dark:border-dark-border dark:text-slate-200 dark:hover:bg-dark-surface2"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChatPanel({
  messages,
  isLoading,
  onSend,
  onClose,
  onClear,
  context = null,
  premiumUser = null,
  remainingFreeMessages = null,
  guestLimitReached = false,
  onLoginWithPremium,
  onBuyPremium,
}) {
  const [input, setInput] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const textareaRef = useRef(null);
  const scrollRef = useRef(null);

  // Re-derived on every render straight from AuthContext's premiumUser  —
  // never cached in local state — so the moment a guest logs in via
  // LoginModal (premiumUser becomes truthy), this flips false immediately
  // with no page refresh needed. Premium users never see the locked state
  // or the free-message counter, full stop, regardless of guestLimitReached.
  const isLocked = !premiumUser && guestLimitReached;
  const showFreeMessageCounter =
    !premiumUser && !isLocked && typeof remainingFreeMessages === "number";

  // Auto-grow the textarea up to 6 lines, then let it scroll internally.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 20; // px, matches text-sm leading-relaxed roughly
    const maxHeight = lineHeight * 6 + 16; // 6 lines + vertical padding
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [input]);

  // Auto-scroll to the latest message whenever the list changes   smooth
  // scroll rather than an instant jump, so new replies don't feel jarring.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH || isLoading || isLocked) return;
    onSend(trimmed);
    setInput("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Shift+Enter falls through to the textarea's default behavior (newline).
    // Esc-to-close is handled globally in ChatWidget so it works even when
    // focus isn't in the textarea.
  }

  function handlePromptClick(prompt) {
    if (isLoading || isLocked) return;
    onSend(prompt);
  }

  function handleClearClick() {
    if (messages.length === 0) return;
    setShowClearConfirm(true);
  }

  function handleConfirmClear() {
    setShowClearConfirm(false);
    onClear();
  }

  function handleCancelClear() {
    setShowClearConfirm(false);
  }

  const charCount = input.length;
  const isOverLimit = charCount > MAX_MESSAGE_LENGTH;
  const isNearLimit = charCount >= CHAR_WARNING_THRESHOLD;
  const canSend = input.trim().length > 0 && !isOverLimit && !isLoading && !isLocked;

  return (
    <div className="relative flex flex-col h-full bg-surface dark:bg-dark-surface">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border dark:border-dark-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center shrink-0">
            <Sparkles className="w-[18px] h-[18px] text-white" />
          </div>
          <div>
            <p className="font-heading font-semibold text-sm text-txt-primary dark:text-slate-100 leading-tight">
              PrepPk AI Assistant
            </p>
            <p className="text-[11px] text-txt-muted dark:text-slate-500 leading-tight">
              Powered by AI · Beta
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleClearClick}
            disabled={messages.length === 0}
            aria-label="Clear conversation"
            title="Clear conversation"
            className="p-1.5 rounded-lg text-txt-secondary hover:text-txt-primary hover:bg-bg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-dark-surface2 transition-colors"
          >
            <Trash2 className="w-[18px] h-[18px]" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="p-1.5 rounded-lg text-txt-secondary hover:text-txt-primary hover:bg-bg dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-dark-surface2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Message list ───────────────────────────────────── */}
      {messages.length === 0 ? (
        <EmptyState context={context} onPromptClick={handlePromptClick} />
      ) : (
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 chat-scrollbar">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {isLoading && <TypingIndicator />}
        </div>
      )}

      {/* ── Footer input row ───────────────────────────────── */}
      <div className="border-t border-border dark:border-dark-border p-3 shrink-0">
        {isLocked ? (
          // ── Locked state (chatbot premium-gating) ─────────────
          // Replaces the input entirely once a guest's 5 free messages
          // are used up. Cleared automatically the instant premiumUser
          // becomes truthy (see isLocked above)   no refresh needed.
          <div className="rounded-2xl border border-border dark:border-dark-border bg-bg dark:bg-dark-surface2 px-4 py-3.5 text-center">
            <div className="flex items-center justify-center gap-1.5 text-txt-primary dark:text-slate-100 mb-1">
              <Lock className="w-3.5 h-3.5" />
              <p className="text-sm font-medium">You've used all 5 free messages</p>
            </div>
            <p className="text-xs text-txt-secondary dark:text-slate-400 mb-3">
              Log in with Premium to keep chatting with no daily worries.
            </p>
            <button
              type="button"
              onClick={onLoginWithPremium}
              className="w-full text-sm font-medium bg-brand text-white rounded-xl py-2 hover:bg-brand-dark transition-colors"
            >
              Login with Premium
            </button>
            <button
              type="button"
              onClick={onBuyPremium}
              className="mt-2 text-xs text-txt-secondary dark:text-slate-400 hover:text-brand hover:underline transition-colors"
            >
              Don't have Premium? Buy access
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-2 bg-bg dark:bg-dark-surface2 rounded-2xl border border-border dark:border-dark-border px-3 py-2 focus-within:border-brand/50 transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Ask about your exam prep..."
                className="flex flex-col justify-center flex-1 resize-none bg-transparent text-sm text-txt-primary dark:text-slate-100 placeholder:text-txt-muted dark:placeholder:text-slate-500 focus:outline-none leading-tight min-h-[42px] max-h-36"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                aria-label="Send message"
                className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  canSend
                    ? "bg-brand text-white hover:bg-brand-dark"
                    : "bg-border text-txt-muted cursor-not-allowed dark:bg-dark-border dark:text-slate-600"
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-1 px-1">
              {/* Guest-only free-message counter (chatbot premium-gating).
                  Never shown to Premium users. */}
              <span className="text-[11px] text-txt-muted dark:text-slate-500">
                {showFreeMessageCounter &&
                  `${remainingFreeMessages} free message${
                    remainingFreeMessages === 1 ? "" : "s"
                  } left`}
              </span>
              <span
                className={`text-[11px] tabular-nums ${
                  isOverLimit
                    ? "text-danger font-medium"
                    : isNearLimit
                    ? "text-accent-dark font-medium"
                    : "text-txt-muted dark:text-slate-500"
                }`}
              >
                {charCount}/{MAX_MESSAGE_LENGTH}
              </span>
            </div>
            <p className="text-[11px] text-txt-muted dark:text-slate-500 text-center mt-1.5 px-1">
              AI responses may be inaccurate — always verify against official exam material.
            </p>
          </>
        )}
      </div>

      {/* ── Clear-conversation confirmation ─────────────────
          Replaces window.confirm() with an in-panel card so it matches
          the app's design tokens instead of the browser's native
          unstyled alert. Absolutely positioned within the panel's own
          `relative` root, so it's clipped to the chat window rather
          than covering the whole page. */}
      {showClearConfirm && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="Clear conversation confirmation"
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[2px] px-6 rounded-2xl"
        >
          <div className="w-full max-w-[280px] rounded-2xl border border-border dark:border-dark-border bg-surface dark:bg-dark-surface shadow-2xl p-5 text-center">
            <div className="w-10 h-10 mx-auto rounded-full bg-danger-light dark:bg-danger/15 flex items-center justify-center mb-3">
              <Trash2 className="w-[18px] h-[18px] text-danger" />
            </div>
            <h3 className="font-heading font-semibold text-sm text-txt-primary dark:text-slate-100">
              Clear this conversation?
            </h3>
            <p className="text-xs text-txt-secondary dark:text-slate-400 mt-1">
              This can't be undone.
            </p>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={handleCancelClear}
                className="flex-1 text-xs font-semibold px-3 py-2 rounded-xl bg-bg hover:bg-border/60 text-txt-primary dark:bg-dark-surface2 dark:hover:bg-dark-border dark:text-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                className="flex-1 text-xs font-semibold px-3 py-2 rounded-xl bg-danger hover:bg-danger-dark text-white transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}