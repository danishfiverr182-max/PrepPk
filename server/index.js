import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import session from "express-session";
import passport from "./config/passport.js";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";

// Existing Part 1 routes
import adminAuthRoutes    from "./routes/adminAuthRoutes.js";
// categoryRoutes replaced in Prompt 09 by publicCategoriesRoutes (public-safe, with cache header)
import userAuthRoutes     from "./routes/userAuthRoutes.js";
import premiumUserRoutes  from "./routes/premiumUserRoutes.js";

// Part 2 new admin auth router mounted at secret path
import adminAuth from "./routes/adminAuth.js";

// Part 3 admin categories router
import adminCategoriesRoutes from "./routes/adminCategories.js";

// Part 3 (Prompt 03) admin dashboard stats router
import adminDashboardRoutes from "./routes/adminDashboard.js";

// Part 3 (Prompt 09) public categories router (no auth)
import publicCategoriesRoutes from "./routes/publicCategories.js";
import publicTestsRoutes from "./routes/publicTests.js";
import premiumTestSectionRoutes from "./routes/premiumTestSection.js";
import publicStatsRoutes from "./routes/publicStats.js";

// Part 4 (Prompt 01) admin test management router
import adminTestsRoutes from "./routes/adminTests.js";

// Part 5 (Prompt 01) admin free mock tests router
import adminFreeMockTestsRoutes from "./routes/adminFreeMockTests.js";

// Prompt 65+66 contact + pricing settings
import publicSettingsRoutes from "./routes/publicSettings.js";
import adminSettingsRoutes  from "./routes/adminSettings.js";

// Prompt 68 public free mock tests listing
import publicFreeTestsRoutes from "./routes/publicFreeTests.js";

// Part 8 Prompt 02 test hub metadata (GET /api/free-tests/:testId)
import publicTestHubRoutes from "./routes/publicTestHub.js";

// Part 8 Prompt 04 section MCQs (GET /api/free-tests/:testId/section/:sectionKey/mcqs)
import publicTestSectionRoutes from "./routes/publicTestSection.js";

// Part 8 Prompt 05 section submit/grading (POST /api/free-tests/:testId/section/:sectionKey/submit)
import publicTestSubmitRoutes from "./routes/publicTestSubmit.js";

// Part 8 Prompt 07 MCQ review (GET /api/free-tests/:testId/section/:sectionKey/review)
import publicTestReviewRoutes from "./routes/publicTestReview.js";

// Part 10   Scoring engine (persistent results for both free and premium tests)
import scoringRoutes from "./routes/scoringRoutes.js";

// Prompt 69 dynamic XML sitemap
import sitemapRouter from "./routes/sitemap.js";

// Part 6 (Prompt 01) plain-password cleanup utility
import { expirePlainPasswords } from "./utils/expirePlainPasswords.js";

// ── Guard: fail fast if critical env vars are missing ─────────
const REQUIRED_ENV = [
  "MONGO_URI",
  "JWT_SECRET",
  "ADMIN_SECRET_PATH",
  "EMAIL_HOST",
  "EMAIL_USER",
  "EMAIL_PASS",
];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`❌ Missing required environment variables: ${missing.join(", ")}`);
  console.error("   Add them to your .env file and restart the server.");
  process.exit(1);
}

// ── Guard: JWT_SECRET must be strong (Go-Live Checklist #2) ──────
// At least 32 characters, and never the placeholder shipped in .env.example.
// A weak/default secret lets anyone forge admin session tokens.
const WEAK_JWT_PLACEHOLDERS = [
  "replace_with_64_char_random_hex",
  "secret",
  "changeme",
];
if (
  process.env.JWT_SECRET.length < 32 ||
  WEAK_JWT_PLACEHOLDERS.includes(process.env.JWT_SECRET.toLowerCase())
) {
  console.error(
    "❌ JWT_SECRET is too weak. It must be at least 32 random characters and not the default placeholder."
  );
  console.error(
    '   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
  );
  process.exit(1);
}

const ADMIN_PATH = process.env.ADMIN_SECRET_PATH; // e.g. /admin-x9k2

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Helmet HTTP security headers ───────────────────────────
// Must be applied before any route definitions so every response
// gets the security headers (X-Frame-Options, X-Content-Type-Options,
// Strict-Transport-Security, etc.)
app.use(
  helmet({
    // Content-Security-Policy is kept off by default here because it
    // requires careful per-project tuning. Enable and configure it
    // explicitly when you know your asset origins.
    contentSecurityPolicy: false,
  })
);

// ── Gzip/Brotli response compression ───────────────────────────
// Was completely missing before   every JSON response (MCQ lists, test
// data, category listings, etc.) was going out uncompressed. JSON
// compresses very well (typically 60-80% smaller), so this directly
// cuts transfer time for every API call, especially on slower mobile
// connections. Placed early, right after helmet, so it applies to
// everything that follows.
app.use(compression());

// ── Morgan request logger (development only) ─────────────────
// Logs every request with method, path, status, and response time.
// Disabled in production so logs stay clean and don't leak paths.
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// ── Middleware ────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:5173",
  "https://mcqsprep-pk.netlify.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
// Limit request body size   raised from 10kb to 2mb so bulk MCQ imports
// (e.g. importing 100-200 questions at once via JSON upload) don't get
// rejected with a 413. Still well below what would enable real abuse.
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// ── Session (Passport / Google OAuth state only) ──────────────
// Stored in memory for simplicity fine for the OAuth handshake
// since the app itself stays stateless via the JWT cookie.
app.use(
  session({
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 10 * 60 * 1000, // only needs to survive the OAuth redirect hops
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// ── MongoDB Connection ────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI, {
    maxPoolSize: 20,       // was implicit default (5) — too small for concurrent test-takers
    minPoolSize: 2,
    serverSelectionTimeoutMS: 10000,
  })
  .then(async () => {
    console.log("✅ MongoDB connected");

    // ── Prompt 3 migration: fix Test indexes for standalone tests ──
    // The old { category, testNumber } unique index applies to ALL tests,
    // causing a duplicate-key error when two groups in the same custom
    // category both create Test 1. We replace it with a partial index
    // that only applies to default (non-standalone) tests, plus a separate
    // partial index that enforces uniqueness per groupId for standalone tests.
    try {
      const testCollection = mongoose.connection.collection("tests");
      const indexes = await testCollection.indexes();
      const oldIndex = indexes.find(
        (ix) =>
          ix.key &&
          ix.key.category === 1 &&
          ix.key.testNumber === 1 &&
          !ix.partialFilterExpression // the OLD index has no partial filter
      );
      if (oldIndex) {
        await testCollection.dropIndex(oldIndex.name);
        console.log("✅ Dropped old category+testNumber unique index");
      }
      // Mongoose will recreate the new partial indexes on next sync
      await mongoose.model("Test").syncIndexes();
      console.log("✅ Test indexes synced");
    } catch (err) {
      console.error("⚠️  Index migration warning (non-fatal):", err.message);
    }
    // ────────────────────────────────────────────────────────────────

    // Part 6: clear any plain-text passwords older than 24h on startup,
    // then repeat every hour so the window stays tight.
    expirePlainPasswords();
    setInterval(expirePlainPasswords, 60 * 60 * 1000);
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err.message));

// ── robots.txt (from Prompt 10 Part 1 / updated Prompt 69) ──────────────────
app.get("/robots.txt", (_req, res) => {
  const base = process.env.CLIENT_URL || `http://localhost:${PORT}`;
  res.type("text/plain");
  res.send(
    `User-agent: *\nDisallow: /admin/\nAllow: /\nSitemap: ${base}/sitemap.xml`
  );
});

// ── Prompt 69 XML sitemap ───────────────────────────────────────────────
app.use("/", sitemapRouter);

// ── Part 1 Routes ─────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

app.use("/api/admin/auth",   adminAuthRoutes);
// Prompt 09: replaced old categoryRoutes with the new public-safe router
// (old categoryRoutes had no field projection or cache header)
app.use("/api/categories",   publicCategoriesRoutes);
app.use("/api/tests",         publicTestsRoutes);
// Premium test engine (MCQs, submit, review require userProtect)
app.use("/api/tests",         premiumTestSectionRoutes);
app.use("/api/stats",         publicStatsRoutes);
app.use("/api/user/auth",    userAuthRoutes);
app.use("/api/admin/users",  premiumUserRoutes);

// ── Part 2 Admin Auth at secret path ───────────────────────
app.use(ADMIN_PATH, adminAuth);

// ── Part 3 Admin Categories (protected) ────────────────────
app.use("/api/admin/categories", adminCategoriesRoutes);

// ── Part 3 (Prompt 03) Admin Dashboard Stats (protected) ───
app.use("/api/admin", adminDashboardRoutes);

// ── Part 4 (Prompt 01) Admin Test Management (protected) ───
// Mount at /api/admin so routes inside become /api/admin/tests/...
app.use("/api/admin", adminTestsRoutes);

// ── Part 5 (Prompt 01) Admin Free Mock Tests (protected) ───
app.use("/api/admin", adminFreeMockTestsRoutes);

// Prompt 65+66 settings (public read + protected write)
app.use("/api/settings", publicSettingsRoutes);
app.use("/api/admin",    adminSettingsRoutes);

// Prompt 68 public free mock tests listing
app.use("/api/free-tests", publicFreeTestsRoutes);

// Part 8 Prompt 02 test hub metadata (GET /api/free-tests/:testId)
app.use("/api/free-tests", publicTestHubRoutes);

// Part 8 Prompt 04 section MCQs (GET /api/free-tests/:testId/section/:sectionKey/mcqs)
app.use("/api/free-tests", publicTestSectionRoutes);

// Part 8 Prompt 05 section submit/grading (POST /api/free-tests/:testId/section/:sectionKey/submit)
app.use("/api/free-tests", publicTestSubmitRoutes);

// Part 8 Prompt 07 MCQ review (GET /api/free-tests/:testId/section/:sectionKey/review)
app.use("/api/free-tests", publicTestReviewRoutes);

// ── Part 10: Scoring engine ───────────────────────────────────────────────────
app.use("/api/results", scoringRoutes);

// ── Custom category test groups (Prompt 2: group + MCQ creation) ──────────
import testGroupRoutes from "./routes/testGroupRoutes.js";
app.use("/api", testGroupRoutes);
// free-custom-tests routes are also inside testGroupRoutes, mounted at /api
// The router handles /api/free-custom-tests/* paths internally

// ── 404 handler for unmatched /api/* routes ──────────────────
// Must sit AFTER all route mounts and BEFORE the global error handler.
// Ensures the public site and API clients always receive JSON, never
// an HTML Express "Cannot GET /api/..." page.
app.use("/api/*path", (_req, res) => {
  res.status(404).json({ message: "API route not found." });
});

// ── Global error handler ──────────────────────────────────────
// Must be defined AFTER all routes so Express recognises it as an
// error-handling middleware (four parameters: err, req, res, next).
//
// Catches any error passed via next(err) or thrown inside an async
// route that Express 5 automatically forwards.
//
// In production: never expose the stack trace or internal message  
//   return a generic "Internal server error" instead.
// In development: surface the real message so debugging is easy.
//
// Security note: ADMIN_SECRET_PATH is deliberately excluded from
// error messages and log output to avoid leaking the secret path.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Log the full error server-side (never send this to the client)
  console.error(`[ERROR] ${req.method} ${req.path} →`, err.message);

  const statusCode = err.status || err.statusCode || 500;

  return res.status(statusCode).json({
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal server error",
  });
});

// ── Start Server ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔐 Admin auth mounted at: ${ADMIN_PATH}`);
});