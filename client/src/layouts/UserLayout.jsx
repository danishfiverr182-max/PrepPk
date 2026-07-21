/**
 * src/layouts/UserLayout.jsx  (Prompt 5   Remove Category Lock System)
 *
 * Changes:
 *  - Removed premiumPopupMode and premiumPopupCategory state.
 *    The popup now always renders in visitor mode   no "upgrade" mode exists.
 *  - openPremiumPopup no longer accepts or forwards { mode, categoryName }.
 *    It only forwards intent to PremiumPopup so the Login button can carry it.
 *  - PremiumPopup no longer receives mode or categoryName props.
 *  - All other behaviour (LoginModal, idle auto-popup, ACCESS_EXPIRED handler,
 *    redirectIntentRef, handleLoginSuccess) is unchanged.
 */

import { useState, useEffect, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";
import Navbar from "../components/user/Navbar";
import Footer from "../components/user/Footer";
import LoginModal from "../components/user/LoginModal";
import PremiumPopup from "../components/user/PremiumPopup";
import ChatWidget from "../components/chat/ChatWidget";
import PublicErrorBoundary from "../public/components/PublicErrorBoundary";
import { useAuth } from "../context/AuthContext";
import useIdleAutoPopup from "../public/hooks/useIdleAutoPopup";
import {
  registerAccessExpiredHandler,
  unregisterAccessExpiredHandler,
} from "../api/axios";

export default function UserLayout() {
  const { premiumUser, setPremiumUser } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [showLogin,          setShowLogin]          = useState(false);
  const [showPremium,        setShowPremium]        = useState(false);
  const [premiumPopupIntent, setPremiumPopupIntent] = useState(null);

  // Stored intent resolved after a successful login.
  // Shape: { pathname, action?, testId?, categorySlug? }
  const redirectIntentRef = useRef(null);

  // ── Global ACCESS_EXPIRED handler ──────────────────────────────────────────
  useEffect(() => {
    const id = registerAccessExpiredHandler(({ message }) => {
      setPremiumUser(null);
      toast.error(message, { duration: 6000 });
      navigate("/", { replace: true });
    });
    return () => unregisterAccessExpiredHandler(id);
  }, [navigate, setPremiumUser]);

  // ── Open Login Modal ───────────────────────────────────────────────────────
  function openLoginModal(intent) {
    setShowPremium(false);
    redirectIntentRef.current = intent ?? { pathname: location.pathname };
    setShowLogin(true);
  }

  // ── Resolve intent after successful login ──────────────────────────────────
  function handleLoginSuccess(user) {
    setShowLogin(false);
    const intent = redirectIntentRef.current;
    redirectIntentRef.current = null; // consume immediately

    if (!intent) return;

    const { action, testId, categorySlug, pathname } = intent;

    if (action === "start-test" && testId && categorySlug) {
      // Any logged-in premium user has access to ALL categories.
      navigate(`/test/${testId}`, { replace: true });
      return;
    }

    // Default: return to whatever page triggered the login
    if (pathname && pathname !== location.pathname) {
      navigate(pathname, { replace: true });
    }
  }

  // ── Open Premium Popup ─────────────────────────────────────────────────────
  // Always visitor mode   no category-specific upgrade flow.
  // intent is forwarded so PremiumPopup's Login button can carry it through.
  function openPremiumPopup({ intent = null } = {}) {
    setPremiumPopupIntent(intent);
    setShowPremium(true);
  }

  // 30-second idle auto-popup (skipped when user is logged in, and
  // suppressed while either modal is already open — including LoginModal,
  // so it can't pop up over/behind an in-progress login).
  useIdleAutoPopup(openPremiumPopup, showPremium || showLogin, !!premiumUser);

  // ── Detect "taking a test" routes ───────────────────────────────────────
  // On these routes we hide the logo/free-tests/login row and the footer so
  // the test itself isn't fighting for space — the category menu stays
  // (promoted to the top bar) so the user can still navigate away or bail
  // out mid-test without feeling stuck.
  // The main premium test engine (TakeTestPage) uses a fixed, full-viewport
  // immersive layout. The other three test-taking pages (custom, free-custom,
  // free-mock) manage their own natural page scroll, so they only need the
  // nav/footer chrome hidden — not the fixed-height treatment.
  const isImmersiveTestRoute =
    /^\/test\/[^/]+\/section\/[^/]+$/.test(location.pathname) ||
    /^\/free-tests\/[^/]+\/section\/[^/]+$/.test(location.pathname);
  const isTestTakingRoute =
    isImmersiveTestRoute ||
    /^\/test\/custom\/[^/]+\/take$/.test(location.pathname) ||
    /^\/test\/free-custom\/[^/]+\/take$/.test(location.pathname);

  return (
    <div
      className={`flex flex-col text-slate-900 dark:text-white ${
        isImmersiveTestRoute ? "h-screen overflow-hidden" : "min-h-screen"
      }`}
      style={{ background: "var(--bg-layout)" }}
    >
      {/* ── Toast notifications ── */}
      <Toaster
        position="bottom-center"
        toastOptions={{
          style:   { fontSize: "13px", maxWidth: "90vw" },
          success: { duration: 3000 },
          error:   { duration: 5000 },
        }}
      />

      <Navbar onLoginClick={() => openLoginModal()} testMode={isTestTakingRoute} />

      <main className={`flex-1 ${isImmersiveTestRoute ? "overflow-hidden min-h-0" : ""}`}>
        <PublicErrorBoundary>
          <Outlet context={{ openPremiumPopup, openLoginModal }} />
        </PublicErrorBoundary>
      </main>

      {!isTestTakingRoute && (
        <Footer onBuyPremiumClick={() => openPremiumPopup()} />
      )}

      {/* ── Modals ─────────────────────────────────────────────── */}
      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onLoginSuccess={handleLoginSuccess}
          onUpgradeClick={() => {
            setShowLogin(false);
            openPremiumPopup();
          }}
        />
      )}

      {showPremium && (
        <PremiumPopup
          intent={premiumPopupIntent}
          onClose={() => setShowPremium(false)}
          onLoginClick={(intent) => openLoginModal(intent)}
        />
      )}

      {/* ── AI Chatbot (Part 11) ──────────────────────────────────
          Mounted for every user-facing route EXCEPT the two immersive
          timed-test routes (premium TakeTestPage, free-mock
          TestSectionPage)   isImmersiveTestRoute already detects exactly
          those two path patterns above, so the widget can't distract or
          be misused as a cheat tool during an actual timed test.
          Never rendered on admin routes since AdminLayout doesn't import it. */}
      {!isImmersiveTestRoute && (
        <ChatWidget openLoginModal={openLoginModal} openPremiumPopup={openPremiumPopup} />
      )}
    </div>
  );
}
