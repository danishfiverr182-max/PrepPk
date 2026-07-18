/**
 * models/PremiumUser.js
 *
 * Premium users have access to ALL categories and tests.
 * No per-category or per-group access control.
 * isExpired() method enforces account expiry.
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const premiumUserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true },

    // Stored temporarily so admin can copy it if they forget.
    // Cleared automatically after 24 hours by expirePlainPasswords utility.
    plainPasswordForAdmin: { type: String, default: null },

    duration: { type: String, enum: ["1-week", "1-month"] },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },

    // Optional admin memo (e.g. "Paid via bank transfer on 27 Jun")
    notes: { type: String, default: "" },

    // ── Favorite categories (cosmetic only) ─────────────────────────────────
    // Category slugs the admin has marked as this user's interest, e.g.
    // because they mentioned wanting "General Knowledge" when they paid.
    // Purely for the navbar highlight-on-login UX touch   this field does
    // NOT affect access control in any way. hasAccessTo() above already
    // grants every premium user access to every category regardless of
    // what's in this list; this array is only ever read by the frontend
    // to decide which nav links to briefly highlight after login.
    favoriteCategories: { type: [String], default: [] },

    // ── Login-security fields ──────────────────────────────────────────────
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },

    // ── Single-active-session fields ────────────────────────────────────────
    // activeSessionId: random token unique to the current login (embedded in
    // the JWT as `sid`). Only one may be set at a time   this is what makes
    // "one device at a time" enforceable across stateless JWT auth.
    // activeSessionExpiresAt mirrors the JWT's own expiry so a session that
    // was never explicitly logged out (crashed device, cleared cookies, etc.)
    // still frees itself up once the token would have expired anyway.
    activeSessionId: { type: String, default: null, select: false },
    activeSessionExpiresAt: { type: Date, default: null, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.plainPasswordForAdmin;
        delete ret.failedLoginAttempts;
        delete ret.lockUntil;
        return ret;
      },
    },
  }
);

// ── Instance Methods ─────────────────────────────────────────────────────────

premiumUserSchema.methods.isLocked = function () {
  return this.lockUntil !== null && this.lockUntil > new Date();
};

premiumUserSchema.methods.isExpired = function () {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

// Premium users have access to ALL categories   slug argument is intentionally
// ignored. Access requires the account to be active and not expired.
premiumUserSchema.methods.hasAccessTo = function (_categorySlug) {
  return this.isActive === true && !this.isExpired();
};

// Premium users have access to ALL sub-groups within an accessible category.
// This method exists for API compatibility   it always returns true for active accounts.
premiumUserSchema.methods.hasGroupAccess = function (_groupSlug) {
  return this.isActive === true && !this.isExpired();
};

premiumUserSchema.methods.recordFailedLogin = async function () {
  this.failedLoginAttempts += 1;
  if (this.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    this.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
  }
  await this.save();
};

premiumUserSchema.methods.resetLoginAttempts = async function () {
  this.failedLoginAttempts = 0;
  this.lockUntil = null;
  await this.save();
};

// ── Single-active-session helpers ──────────────────────────────────────────

// True while a session is currently claimed AND hasn't passed its own
// expiry. A stale session (token would have expired anyway) is treated as
// no session, so it never permanently locks the account out.
premiumUserSchema.methods.hasActiveSession = function () {
  return (
    !!this.activeSessionId &&
    !!this.activeSessionExpiresAt &&
    this.activeSessionExpiresAt > new Date()
  );
};

// Claim the account for a new login. Call only after confirming
// hasActiveSession() is false.
premiumUserSchema.methods.startSession = async function (sessionId, expiresAt) {
  this.activeSessionId = sessionId;
  this.activeSessionExpiresAt = expiresAt;
  await this.save();
};

// Release the account so it can be logged into elsewhere. Used on logout
// and by the admin "force logout" action.
premiumUserSchema.methods.endSession = async function () {
  this.activeSessionId = null;
  this.activeSessionExpiresAt = null;
  await this.save();
};

// ── Hooks ────────────────────────────────────────────────────────────────────

premiumUserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

premiumUserSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const PremiumUser = mongoose.model("PremiumUser", premiumUserSchema);
export default PremiumUser;