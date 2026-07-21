/**
 * src/context/ChatContext.jsx  (Part 11   Prompt 4)
 *
 * Global chat state, following the same createContext/Provider/useX()
 * pattern as src/context/AuthContext.jsx.
 *
 * Owns:
 *   - messages   array of { id, role, content, isError? }
 *   - isOpen     whether the chat panel is open (drives ChatWidget)
 *   - isLoading  true while waiting on the assistant's reply
 *   - error      last error message, if any (also shown inline + toasted)
 *   - sendMessage(text)   optimistic-append, call the API, append the
 *                         reply or a friendly inline error bubble
 *   - pageContext   auto-detected { categoryName, testName } from
 *                   useChatContext(), forwarded to the API on every send
 *                   and to ChatPanel for its suggested-prompt chips
 *   - remainingFreeMessages   guest-only free-message counter (5 by
 *                   default), updated from the backend's
 *                   `remainingFreeMessages` field on every successful
 *                   response. Meaningless/unused for Premium users.
 *   - guestLimitReached   true once a guest's 5 free messages are used
 *                   up (either because remainingFreeMessages hit 0, or
 *                   because a send attempt came back with
 *                   code "CHAT_GUEST_LIMIT_REACHED"). ChatWidget/
 *                   ChatPanel combine this with AuthContext's
 *                   premiumUser to decide whether to show the
 *                   locked/upsell state   see ChatPanel.jsx.
 *
 * Persistence: the conversation is saved to sessionStorage (NOT
 * localStorage)   it survives a page refresh but clears when the tab
 * closes, so old conversations don't linger across sessions. Capped at
 * 20 messages, oldest trimmed first.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import toast from "react-hot-toast";
import api from "../api/axios";
import { sendChatMessage, ChatApiError } from "../api/chat";
import useChatContext from "../hooks/useChatContext";

const ChatContext = createContext(null);

const SESSION_STORAGE_KEY = "preppk_chat_messages";
const MAX_STORED_MESSAGES = 20;
const MAX_HISTORY_TURNS = 10;

// Mirrors GUEST_LIFETIME_CAP in server/controllers/chatController.js   used
// only as the initial/default display value before the first message of a
// visit; the backend's `remainingFreeMessages` is always the source of truth
// once a request has gone through.
const GUEST_FREE_MESSAGE_LIMIT = 5;

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `msg-${Date.now()}-${idCounter}`;
}

function loadStoredMessages() {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    );
  } catch {
    return [];
  }
}

function persistMessages(messages) {
  try {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(messages.slice(-MAX_STORED_MESSAGES))
    );
  } catch {
    // sessionStorage unavailable (private browsing, quota, etc.)   chat
    // still works for the rest of the tab session, it just won't survive
    // a refresh. Never let this break the chat itself.
  }
}

export function ChatProvider({ children }) {
  const [messages, setMessages] = useState(loadStoredMessages);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // AI Chatbot kill switch (Part 11   Prompt 5). Defaults to true so a
  // transient settings-fetch failure never hides the widget on its own
  // only an explicit `false` from the admin does that. Reuses the same
  // GET /settings/contact endpoint the rest of the app already calls for
  // contact/pricing info (see public/context/PublicSettingsContext.jsx)
  // rather than adding a second settings round trip.
  const [aiChatbotEnabled, setAiChatbotEnabled] = useState(true);

  // Guest-only free-message tracking (chatbot premium-gating). Both are
  // meaningless for Premium users   ChatPanel checks AuthContext's
  // premiumUser first and never surfaces this UI for them regardless of
  // what these hold.
  const [remainingFreeMessages, setRemainingFreeMessages] = useState(
    GUEST_FREE_MESSAGE_LIMIT
  );
  const [guestLimitReached, setGuestLimitReached] = useState(false);

  // Auto-detected from the current route (category/test pages only   see
  // hooks/useChatContext.js). null everywhere else, including admin routes.
  const pageContext = useChatContext();

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    let cancelled = false;
    api
      .get("/settings/contact")
      .then(({ data }) => {
        if (!cancelled && typeof data.aiChatbotEnabled === "boolean") {
          setAiChatbotEnabled(data.aiChatbotEnabled);
        }
      })
      .catch(() => {
        // Network hiccup   leave the default (enabled) in place rather
        // than punishing the user for an unrelated settings-fetch failure.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    persistMessages(messages);
  }, [messages]);

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = (text || "").trim();
      // Also guards against sending once a guest is already locked out
      // (the UI hides the input in this state, but this is a cheap
      // belt-and-suspenders check against stale UI or programmatic calls).
      if (!trimmed || isLoading || guestLimitReached) return;

      setError(null);

      // History = the conversation as it stood BEFORE this new message,
      // capped at the last 10 turns to match the backend's own cap.
      const history = messagesRef.current
        .slice(-MAX_HISTORY_TURNS)
        .map(({ role, content }) => ({ role, content }));

      const userMessage = { id: nextId(), role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMessage].slice(-MAX_STORED_MESSAGES));
      setIsLoading(true);

      try {
        const { reply, model, remainingFreeMessages: remaining } = await sendChatMessage(
          trimmed,
          history,
          pageContext
        );
        const assistantMessage = {
          id: nextId(),
          role: "assistant",
          content: reply,
          model,
        };
        setMessages((prev) => [...prev, assistantMessage].slice(-MAX_STORED_MESSAGES));

        // Only present for guest callers (undefined for Premium users).
        if (typeof remaining === "number") {
          setRemainingFreeMessages(remaining);
          if (remaining <= 0) setGuestLimitReached(true);
        }
      } catch (err) {
        // Guest hit their 5-message lifetime cap: this is NOT a normal
        // error   don't add an inline error bubble or toast. Instead flip
        // guestLimitReached so ChatWidget/ChatPanel swap to the locked/
        // upsell state (see ChatPanel.jsx).
        if (err instanceof ChatApiError && err.code === "CHAT_GUEST_LIMIT_REACHED") {
          setGuestLimitReached(true);
          setRemainingFreeMessages(0);
          return; // finally below still resets isLoading
        }

        const message =
          err instanceof ChatApiError
            ? err.message
            : "Something went wrong sending your message. Please try again.";

        setError(message);

        // Friendly inline bubble so the conversation itself explains what
        // happened   never a raw error, never a crash.
        const errorMessage = {
          id: nextId(),
          role: "assistant",
          content: message,
          isError: true,
        };
        setMessages((prev) => [...prev, errorMessage].slice(-MAX_STORED_MESSAGES));

        // Rate-limit / daily-cap / busy errors also get a toast, so they're
        // visible even if the user has minimized the chat panel.
        if (err instanceof ChatApiError && (err.status === 429 || err.status === 503)) {
          toast.error(message, { duration: 6000 });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, pageContext, guestLimitReached]
  );

  const openChat = useCallback(() => setIsOpen(true), []);
  const closeChat = useCallback(() => setIsOpen(false), []);
  const toggleChat = useCallback(() => setIsOpen((prev) => !prev), []);

  // "Clear conversation" (Prompt 5 polish)   resets in-memory state AND
  // the sessionStorage entry, so a refresh doesn't bring the old
  // conversation back.
  const clearConversation = useCallback(() => {
    setMessages([]);
    setError(null);
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // sessionStorage unavailable   in-memory state is already cleared,
      // which is the part that actually matters to the user.
    }
  }, []);

  const value = useMemo(
    () => ({
      messages,
      isOpen,
      isLoading,
      error,
      sendMessage,
      openChat,
      closeChat,
      toggleChat,
      clearConversation,
      pageContext,
      aiChatbotEnabled,
      remainingFreeMessages,
      guestLimitReached,
    }),
    [
      messages,
      isOpen,
      isLoading,
      error,
      sendMessage,
      openChat,
      closeChat,
      toggleChat,
      clearConversation,
      pageContext,
      aiChatbotEnabled,
      remainingFreeMessages,
      guestLimitReached,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  return useContext(ChatContext);
}
