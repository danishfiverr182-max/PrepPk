import { createBrowserRouter, RouterProvider, Outlet, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { ChatProvider } from "./context/ChatContext";
import ProtectedAdminRoute from "./components/admin/ProtectedAdminRoute";
import AdminErrorBoundary from "./components/admin/AdminErrorBoundary";
import PublicErrorBoundary from "./public/components/PublicErrorBoundary";
import ErrorPage from "./public/components/ErrorPage";
import UserLayout from "./layouts/UserLayout";
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
import { PublicCategoriesProvider } from "./public/context/PublicCategoriesContext";
import { useTheme } from "./context/ThemeContext";

// ── Page components are lazy-loaded (route-based code splitting) ──────
// Previously every page   including the entire admin panel (dashboard,
// test builder, MCQ editors, user management, etc.)   was statically
// imported here, so every visitor downloaded and parsed all of it just
// to view the public homepage. Converting these to React.lazy() means
// each page's JS only downloads when its route is actually visited.
// Structural pieces above (layouts, contexts, error boundaries,
// ProtectedAdminRoute) stay as regular imports since they're small,
// used by nearly every route anyway, and lazy-loading them would add
// complexity for no real benefit.

// User pages
const HomePage                  = lazy(() => import("./pages/user/HomePage"));
const CategoryPage              = lazy(() => import("./pages/user/CategoryPage"));
const TestGroupPage             = lazy(() => import("./pages/user/TestGroupPage"));
const FreeMockTestsPage         = lazy(() => import("./pages/user/FreeMockTestsPage"));
const TestHubPage               = lazy(() => import("./pages/user/TestHubPage"));
const TakeTestPage              = lazy(() => import("./pages/user/TakeTestPage"));
const PremiumSectionResultPage  = lazy(() => import("./pages/user/SectionResultPage"));
const PremiumMcqReviewPage      = lazy(() => import("./pages/user/McqReviewPage"));
const NotFoundPage              = lazy(() => import("./pages/user/NotFoundPage"));

// Public-facing blog (Prompt 5) — aliased to avoid a name clash with the
// admin pages/admin/BlogListPage import below.
const PublicBlogListPage = lazy(() => import("./pages/user/BlogListPage"));
const PublicBlogPostPage = lazy(() => import("./pages/user/BlogPostPage"));

// Static legal/info pages (Privacy Policy, Terms, Disclaimer, About, Contact)
const PrivacyPolicyPage    = lazy(() => import("./pages/user/legal/PrivacyPolicyPage"));
const TermsConditionsPage  = lazy(() => import("./pages/user/legal/TermsConditionsPage"));
const DisclaimerPage       = lazy(() => import("./pages/user/legal/DisclaimerPage"));
const AboutUsPage          = lazy(() => import("./pages/user/legal/AboutUsPage"));
const ContactUsPage        = lazy(() => import("./pages/user/legal/ContactUsPage"));

// Part 8 Free Mock Test Engine
const TestSectionPage       = lazy(() => import("./public/pages/TestSectionPage"));
const SectionResultPage     = lazy(() => import("./public/pages/SectionResultPage"));
const McqReviewPage         = lazy(() => import("./public/pages/McqReviewPage"));
// TestHubPage for Part 8 routes (public folder version)
const FreeMockTestHubPage   = lazy(() => import("./public/pages/TestHubPage"));

// Admin pages (Part 1)
const AdminLoginPage     = lazy(() => import("./pages/admin/AdminLoginPage"));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminAddTestPage   = lazy(() => import("./pages/admin/AdminAddTestPage"));
const AdminUsersPage     = lazy(() => import("./pages/admin/AdminUsersPage"));

// AI Chatbot analytics (Part 11   Prompt 5)
const ChatAnalyticsPage  = lazy(() => import("./pages/admin/ChatAnalyticsPage"));

// AI Chatbot key pool admin UI (Part 12   Prompt 9)
const ApiKeyPoolPage = lazy(() => import("./pages/admin/ApiKeyPoolPage"));

// Standalone admin-authored blog (Prompt 4)
const BlogListPage = lazy(() => import("./pages/admin/BlogListPage"));
const BlogEditorPage = lazy(() => import("./pages/admin/BlogEditorPage"));

// SEO health / internal-link diagnostic (final SEO pass)
const SeoHealthPage = lazy(() => import("./pages/admin/SeoHealthPage"));

// Admin auth page (Part 2)
const AdminAuth = lazy(() => import("./pages/admin/AdminAuth"));

// Admin homepage (Prompt 03)
const AdminHomePage = lazy(() => import("./pages/admin/AdminHomePage"));

// Per-category test list page (Prompt 06)
const AdminCategoryPage = lazy(() => import("./pages/admin/CategoryPage"));

// Section pages
const VerbalSectionPage    = lazy(() => import("./pages/admin/VerbalSectionPage"));
const NonVerbalSectionPage = lazy(() => import("./pages/admin/NonVerbalSectionPage"));
const AcademicSectionPage  = lazy(() => import("./pages/admin/AcademicSectionPage"));

// Test view page (Prompt 08)
const TestViewPage = lazy(() => import("./pages/admin/TestViewPage"));

// Part 5 Free Mock Tests admin pages
const FreeMockTestsAdminPage       = lazy(() => import("./pages/admin/FreeMockTestsPage"));
const FreeMockVerbalSectionPage    = lazy(() => import("./pages/admin/free-mock/FreeMockVerbalSectionPage"));
const FreeMockNonVerbalSectionPage = lazy(() => import("./pages/admin/free-mock/FreeMockNonVerbalSectionPage"));
const FreeMockAcademicSectionPage  = lazy(() => import("./pages/admin/free-mock/FreeMockAcademicSectionPage"));
const FreeMockTestViewPage         = lazy(() => import("./pages/admin/free-mock/FreeMockTestViewPage"));

// Custom category test creation (Prompt 2)
const AdminCustomTestPage     = lazy(() => import("./pages/admin/AdminCustomTestPage"));
const AdminFreeCustomTestPage = lazy(() => import("./pages/admin/AdminFreeCustomTestPage"));

// Custom category user pages (Prompt 3)
const CustomTestHubPage        = lazy(() => import("./pages/user/CustomTestHubPage"));
const FreeCustomTestHubPage    = lazy(() => import("./pages/user/FreeCustomTestHubPage"));
const FreeCustomTakeTestPage   = lazy(() => import("./pages/user/FreeCustomTakeTestPage"));
const FreeCustomTestResultPage = lazy(() => import("./pages/user/FreeCustomTestResultPage"));
const CustomTakeTestPage       = lazy(() => import("./pages/user/CustomTakeTestPage"));
const CustomTestResultPage     = lazy(() => import("./pages/user/CustomTestResultPage"));

const ADMIN_SECRET_PATH = import.meta.env.VITE_ADMIN_PATH || "/admin-x9k2";

// ── Full-page loading fallback shown briefly while a route's JS chunk
// downloads. Uses the same design tokens (bg-bg, border-brand) already
// used throughout the admin modals, so it looks native rather than like
// a generic placeholder. On a fast connection this is barely visible.
function PageLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ── Scroll-to-top on route change ──────────────────────────────────
// createBrowserRouter/RouterProvider does NOT auto-scroll on navigation
// (that's a plain-<BrowserRouter> browser default, not something the data
// router replicates). Without this, navigating from the homepage to a
// category/test/page while scrolled down keeps that same scroll offset,
// so the new page renders starting mid-way down instead of at the top.
// Scoped to `pathname` only (not search/hash) so hash-anchor navigation
// and query-param updates on the same page aren't yanked back to top.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// ── Root wrapper providers that need to be inside the data router ──
function RootProviders() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <AuthProvider>
      <AdminAuthProvider>
        <ChatProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                fontSize: "14px",
                background: isDark ? "#1E293B" : "#fff",
                color: isDark ? "#F1F5F9" : "#1E293B",
                border: "1px solid",
                borderColor: isDark ? "#334155" : "#CBD5E1",
              },
              success: { duration: 3000 },
              error: { duration: 4000 },
            }}
          />
          <ScrollToTop />
          <Suspense fallback={<PageLoadingFallback />}>
            <Outlet />
          </Suspense>
        </ChatProvider>
      </AdminAuthProvider>
    </AuthProvider>
  );
}

// ── Coming-soon stub ─────────────────────────────────────────────────
const ComingSoon = ({ title, note }) => (
  <div className="max-w-2xl mx-auto px-4 py-16 text-center">
    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-10">
      <span className="inline-block text-xs font-semibold uppercase tracking-widest text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-3 py-1 rounded-full mb-4">
        Coming Soon
      </span>
      <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
      {note && <p className="text-gray-400 text-sm">{note}</p>}
    </div>
  </div>
);

// ── Router definition ────────────────────────────────────────────────
const router = createBrowserRouter([
  {
    element: <RootProviders />,
    children: [
      // ── User routes ────────────────────────────────────────────────
      {
        element: (
          <PublicCategoriesProvider>
            <UserLayout />
          </PublicCategoriesProvider>
        ),
        children: [
          { path: "/",                                       element: <PublicErrorBoundary><HomePage /></PublicErrorBoundary> },
          { path: "/free-mock-tests",                        element: <PublicErrorBoundary><FreeMockTestsPage /></PublicErrorBoundary> },
          { path: "/blog",                                   element: <PublicErrorBoundary><PublicBlogListPage /></PublicErrorBoundary> },
          { path: "/blog/:slug",                             element: <PublicErrorBoundary><PublicBlogPostPage /></PublicErrorBoundary> },

          // Static legal/info pages
          { path: "/privacy-policy",       element: <PublicErrorBoundary><PrivacyPolicyPage /></PublicErrorBoundary> },
          { path: "/terms-and-conditions", element: <PublicErrorBoundary><TermsConditionsPage /></PublicErrorBoundary> },
          { path: "/disclaimer",           element: <PublicErrorBoundary><DisclaimerPage /></PublicErrorBoundary> },
          { path: "/about-us",             element: <PublicErrorBoundary><AboutUsPage /></PublicErrorBoundary> },
          { path: "/contact-us",           element: <PublicErrorBoundary><ContactUsPage /></PublicErrorBoundary> },
          { path: "/category/:slug",                         element: <PublicErrorBoundary><CategoryPage /></PublicErrorBoundary> },
          { path: "/category/:slug/:groupSlug",              element: <PublicErrorBoundary><TestGroupPage /></PublicErrorBoundary> },
          // Custom category test routes (Prompt 3) — static segment "custom" must come before dynamic :testId
          { path: "/test/custom/:testId",      element: <PublicErrorBoundary><CustomTestHubPage /></PublicErrorBoundary> },
          { path: "/test/custom/:testId/take", element: <CustomTakeTestPage /> },
          { path: "/result/custom",            element: <PublicErrorBoundary><CustomTestResultPage /></PublicErrorBoundary> },
          { path: "/test/free-custom/:testId",      element: <PublicErrorBoundary><FreeCustomTestHubPage /></PublicErrorBoundary> },
          { path: "/test/free-custom/:testId/take", element: <FreeCustomTakeTestPage /> },
          { path: "/result/free-custom",            element: <PublicErrorBoundary><FreeCustomTestResultPage /></PublicErrorBoundary> },

          { path: "/test/:testId",                           element: <TestHubPage /> },
          { path: "/test/:testId/section/:sectionKey",      element: <TakeTestPage /> },
          // Flat result route — TakeTestPage navigates here on submit (result data is passed via location.state)
          { path: "/result/section",                          element: <PremiumSectionResultPage /> },
          { path: "/test/:testId/section/:sectionKey/result",  element: <PremiumSectionResultPage /> },
          { path: "/test/:testId/section/:sectionKey/review",  element: <PremiumMcqReviewPage /> },

          // ── Part 8 Free Mock Test Engine (Prompt 80: errorElement on every route) ──
          {
            path: "/free-tests/:testId/hub",
            element: <PublicErrorBoundary><FreeMockTestHubPage /></PublicErrorBoundary>,
            errorElement: <ErrorPage />,
          },
          {
            path: "/free-tests/:testId/section/:sectionKey",
            element: <TestSectionPage />,
            errorElement: <ErrorPage message="Something went wrong loading the test. Please go back and try again." />,
          },
          {
            path: "/free-tests/:testId/section/:sectionKey/result",
            element: <PublicErrorBoundary><SectionResultPage /></PublicErrorBoundary>,
            errorElement: <ErrorPage />,
          },
          {
            path: "/free-tests/:testId/section/:sectionKey/review",
            element: <PublicErrorBoundary><McqReviewPage /></PublicErrorBoundary>,
            errorElement: <ErrorPage />,
          },

          { path: "*",                                       element: <NotFoundPage /> },
        ],
      },

      // ── Legacy admin login ─────────────────────────────────────────
      { path: "/admin/login", element: <AdminLoginPage /> },

      // ── Part 2 Admin Auth secret path ───────────────────────────
      {
        path: ADMIN_SECRET_PATH,
        element: (
          <AdminErrorBoundary>
            <AdminAuth />
          </AdminErrorBoundary>
        ),
      },

      // ── Protected admin routes ─────────────────────────────────────
      {
        element: (
          <AdminErrorBoundary>
            <ProtectedAdminRoute>
              <AdminLayout />
            </ProtectedAdminRoute>
          </AdminErrorBoundary>
        ),
        children: [
          { path: "/admin",           element: <AdminHomePage /> },
          { path: "/admin/dashboard", element: <AdminDashboardPage /> },
          { path: "/admin/add-test/:category", element: <AdminAddTestPage /> },
          { path: "/admin/users",     element: <AdminUsersPage /> },
          { path: "/admin/chat-analytics", element: <ChatAnalyticsPage /> },
          { path: "/admin/api-keys", element: <ApiKeyPoolPage /> },

          // Standalone blog (Prompt 4)
          { path: "/admin/blog", element: <AdminErrorBoundary><BlogListPage /></AdminErrorBoundary> },
          { path: "/admin/blog/new", element: <AdminErrorBoundary><BlogEditorPage /></AdminErrorBoundary> },
          { path: "/admin/blog/:postId", element: <AdminErrorBoundary><BlogEditorPage /></AdminErrorBoundary> },

          { path: "/admin/seo-health", element: <AdminErrorBoundary><SeoHealthPage /></AdminErrorBoundary> },

          // Free Mock Tests
          { path: "/admin/free-mock-tests",                                              element: <FreeMockTestsAdminPage /> },
          { path: "/admin/free-mock-tests/:slug/test/:testId/add-verbal",               element: <AdminErrorBoundary><FreeMockVerbalSectionPage /></AdminErrorBoundary> },
          { path: "/admin/free-mock-tests/:slug/test/:testId/add-nonverbal",            element: <AdminErrorBoundary><FreeMockNonVerbalSectionPage /></AdminErrorBoundary> },
          { path: "/admin/free-mock-tests/:slug/test/:testId/add-academic",             element: <AdminErrorBoundary><FreeMockAcademicSectionPage /></AdminErrorBoundary> },
          { path: "/admin/free-mock-tests/:slug/test/:testId/view",                     element: <FreeMockTestViewPage /> },

          // Premium test management
          { path: "/admin/dashboard/category/:slug",                                    element: <AdminCategoryPage /> },
          { path: "/admin/dashboard/category/:slug/test/:testId/add-verbal",            element: <VerbalSectionPage /> },
          { path: "/admin/dashboard/category/:slug/test/:testId/add-nonverbal",         element: <NonVerbalSectionPage /> },
          { path: "/admin/dashboard/category/:slug/test/:testId/add-academic",          element: <AcademicSectionPage /> },
          { path: "/admin/dashboard/category/:slug/test/:testId/view",                  element: <TestViewPage /> },
          {
            path: "/admin/dashboard/category/:slug/create-test",
            element: <ComingSoon title="Create Test" note="This page will be implemented in Part 5." />,
          },

          // Custom category test page — canonical route (Prompt 9C)
          { path: "/admin/custom-test/:testId", element: <AdminErrorBoundary><AdminCustomTestPage /></AdminErrorBoundary> },
          { path: "/admin/free-mock-test/custom/:testId", element: <AdminErrorBoundary><AdminFreeCustomTestPage /></AdminErrorBoundary> },
          // Legacy /add-mcqs alias — keeps existing navigate() calls working
          { path: "/admin/custom-test/:testId/add-mcqs", element: <AdminErrorBoundary><AdminCustomTestPage /></AdminErrorBoundary> },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}