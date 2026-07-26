import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import Admin from "../models/Admin.js";
import { isAllowedAdminEmail, maskEmail } from "../utils/adminAllowlist.js";

// ── Build the callback URL ─────────────────────────────────────
// Prefer an explicit env override; otherwise derive it from the
// server's own base URL + the secret admin path.
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
const ADMIN_PATH = process.env.ADMIN_SECRET_PATH || "/admin-x9k2";
const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL || `${SERVER_URL}${ADMIN_PATH}/auth/google/callback`;

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value?.toLowerCase().trim();
        const avatar = profile.photos?.[0]?.value || null;
        const displayName = profile.displayName || "Admin";

        if (!email) {
          return done(new Error("Google account has no email."), null);
        }

        // ── Allowlist gate ────────────────────────────────────────────
        // This is the boundary that actually matters. Without it, ANY
        // Google account that reaches the OAuth callback gets a brand-new
        // verified Admin document created for it automatically (see the
        // Admin.create() below) — meaning the admin secret URL would be the
        // *only* thing standing between a random Google sign-in and full
        // dashboard access. Reject here, before any DB lookup or write.
        //
        // `done(null, false, { message })` is Passport's standard "auth
        // failed" signal — it triggers the route's failureRedirect, exactly
        // like a wrong password would, rather than throwing an error.
        if (!isAllowedAdminEmail(email)) {
          console.warn(`[google-oauth] Blocked sign-in attempt for non-allowlisted email: ${maskEmail(email)}`);
          return done(null, false, { message: "not_allowed" });
        }

        // 1 Look for an existing admin by googleId OR email
        let admin = await Admin.findOne({ $or: [{ googleId }, { email }] });

        if (admin) {
          // 2 Found by email but not yet linked to this Google account → merge
          if (!admin.googleId) {
            admin.googleId = googleId;
            if (!admin.avatar) admin.avatar = avatar;
            admin.isVerified = true; // Google's verified identity is trusted directly
            await admin.save();
          }
          return done(null, admin);
        }

        // 3 No existing account → create a brand-new admin via Google
        admin = await Admin.create({
          fullName: displayName,
          email,
          googleId,
          avatar,
          isVerified: true,
        });

        return done(null, admin);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// ── Session (de)serialization ──────────────────────────────────
// Only needed to bridge the OAuth redirect hops via express-session.
// The app itself stays stateless JWT cookie is what authenticates
// subsequent API requests, not the session.
passport.serializeUser((admin, done) => {
  done(null, admin._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const admin = await Admin.findById(id);
    done(null, admin);
  } catch (err) {
    done(err, null);
  }
});

export default passport;
