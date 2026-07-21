/**
 * components/chat/ChatWidget.jsx  (Part 11   Prompt 4 backend wiring
 * + Prompt 5 admin kill switch / keyboard polish; MODIFIED — chatbot
 * premium-gating)
 *
 * Floating AI chat entry point for PrepPk. Mounted once, globally, inside
 * UserLayout (see layouts/UserLayout.jsx)   never on admin routes, and
 * UserLayout itself skips mounting this at all on the two immersive
 * test-taking routes (premium TakeTestPage, free-mock TestSectionPage) so
 * it can't be a distraction (or a cheat tool) during a timed test.
 *
 * All state (messages, open/closed, loading, page context, guest
 * free-message counter/limit, and the admin's aiChatbotEnabled kill
 * switch) comes from ChatContext.
 *
 * Props (NEW   forwarded from UserLayout, same functions passed to
 * routed pages via <Outlet context={{ openPremiumPopup, openLoginModal }} />):
 *   openLoginModal(intent)          opens components/user/LoginModal.jsx
 *   openPremiumPopup({ intent })    opens components/user/PremiumPopup.jsx
 * Used only for the guest locked/upsell state (see ChatPanel.jsx)   once
 * a guest logs in via LoginModal, AuthContext's premiumUser flips truthy
 * and the locked state clears immediately (ChatPanel re-derives it from
 * premiumUser on every render, not from any cached local state).
 */

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";
import ChatPanel from "./ChatPanel.jsx";
import { useChat } from "../../context/ChatContext";
import { useAuth } from "../../context/AuthContext";

export default function ChatWidget({ openLoginModal, openPremiumPopup }) {
  const {
    messages,
    isOpen,
    isLoading,
    sendMessage,
    closeChat,
    toggleChat,
    clearConversation,
    pageContext,
    aiChatbotEnabled,
    remainingFreeMessages,
    guestLimitReached,
  } = useChat();
  const { premiumUser } = useAuth();
  const location = useLocation();

  // Esc closes the panel while it's open   keyboard parity with the
  // header's close button and the mobile full-screen sheet.
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === "Escape") closeChat();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeChat]);

  // Admin kill switch (Part 11   Prompt 5): if disabled, render nothing
  // at all no FAB, no panel, no DOM footprint.
  if (!aiChatbotEnabled) return null;

  // ── Locked-state actions (chatbot premium-gating) ─────────────
  // `intent` here follows the same { pathname, ... } shape used elsewhere
  // for post-login redirects (see UserLayout.jsx/CategoryPage.jsx) — we
  // add a `source: "chatbot"` marker alongside it so PremiumPopup/
  // LoginModal can optionally show chatbot-specific copy later without
  // touching their existing intent handling (both already just forward
  // unrecognized fields through, they don't validate the shape).
  function buildChatIntent() {
    return { pathname: location.pathname, source: "chatbot" };
  }

  function handleLoginWithPremium() {
    openLoginModal?.(buildChatIntent());
  }

  function handleBuyPremium() {
    openPremiumPopup?.({ intent: buildChatIntent() });
  }

  return (
    <>
      {/* ── Floating action button ─────────────────────────── */}
      <button
        type="button"
        onClick={toggleChat}
        aria-label={isOpen ? "Close AI assistant" : "Open AI assistant"}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-brand text-white shadow-lg hover:bg-brand-dark flex items-center justify-center transition-all duration-200 ease-out hover:scale-105 active:scale-95 ${
          isOpen ? "opacity-0 scale-0 pointer-events-none" : "opacity-100 scale-100"
        }`}
      >
        <Sparkles className="w-6 h-6" />
      </button>

      {/* ── Chat panel container ──────────────────────────────
          Mobile (<640px): full-screen sheet   fixed inset-0, no radius.
          Desktop (>=640px): floating card anchored bottom-right.
          Always mounted so the open/close scale+fade transition runs
          both ways without extra mount/unmount timing logic. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-hidden={!isOpen}
        aria-label="PrepPk AI Assistant chat"
        className={`fixed inset-0 z-50 flex flex-col bg-surface dark:bg-dark-surface overflow-hidden
          transition-all duration-200 ease-out origin-bottom-right
          sm:inset-auto sm:top-28 sm:bottom-6 sm:right-6 sm:w-full sm:max-w-md sm:max-h-[680px]
          sm:rounded-2xl sm:border sm:border-border sm:dark:border-dark-border sm:shadow-2xl
          ${
            isOpen
              ? "opacity-100 scale-100"
              : "opacity-0 scale-95 pointer-events-none"
          }`}
      >
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          onSend={sendMessage}
          onClose={closeChat}
          onClear={clearConversation}
          context={pageContext}
          premiumUser={premiumUser}
          remainingFreeMessages={remainingFreeMessages}
          guestLimitReached={guestLimitReached}
          onLoginWithPremium={handleLoginWithPremium}
          onBuyPremium={handleBuyPremium}
        />
      </div>
    </>
  );
}