/**
 * models/ChatUsage.js  (Part 11   Prompt 2; MODIFIED — chatbot premium-gating)
 *
 * Tracks chatbot usage so it can be capped, but the shape of that cap is
 * now genuinely different for guests vs PremiumUsers, so this model tracks
 * two distinct *kinds* of row rather than forcing both into one
 * "identifier + date" daily-reset shape:
 *
 *  - kind: "guest_lifetime"
 *      One row per anonymous visitor, keyed by their chatGuestId cookie
 *      (see middleware/chatGuestId.js). `count` is a LIFETIME total that
 *      never resets — once it crosses the 5-message cap it stays capped
 *      forever, until the visitor logs in as a Premium user. `date` is
 *      always the literal string "lifetime" for these rows (see note
 *      below on why this is a real field value rather than just omitted).
 *
 *  - kind: "premium_daily"
 *      One row per (PremiumUser _id, day) pair, same as the original
 *      daily-reset design   `date` is a real "YYYY-MM-DD" bucket that
 *      resets at midnight. This is purely an abuse/cost safety net for
 *      logged-in Premium users now (see PREMIUM_DAILY_CAP in
 *      chatController.js), not a marketed limit.
 *
 * Why `date` is always populated (never omitted) for BOTH kinds:
 * a compound unique index on a field that's sometimes present and
 * sometimes missing relies on MongoDB's "missing field indexes as null"
 * behavior, which is easy to get subtly wrong once there's more than one
 * row per identifier (as premium_daily rows already are, one per day).
 * Giving guest_lifetime rows a real, constant date value ("lifetime")
 * keeps the (identifier, kind, date) index unambiguous and behaves
 * identically for both kinds   there is still exactly one guest_lifetime
 * row per chatGuestId, since kind+date never vary for that kind.
 */

import mongoose from "mongoose";

const { Schema } = mongoose;

// Constant `date` value used for every guest_lifetime row   see note above.
export const GUEST_LIFETIME_DATE = "lifetime";

const chatUsageSchema = new Schema(
  {
    // chatGuestId cookie value (guest_lifetime) or PremiumUser _id.toString()
    // (premium_daily).
    identifier: {
      type: String,
      required: true,
      trim: true,
    },
    // Which cap regime this row belongs to.
    kind: {
      type: String,
      enum: ["guest_lifetime", "premium_daily"],
      required: true,
    },
    // "YYYY-MM-DD" server-local date bucket for premium_daily rows;
    // always the literal string "lifetime" for guest_lifetime rows.
    date: {
      type: String,
      required: true,
    },
    count: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// One row per (identifier, kind, date):
//  - guest_lifetime: exactly one row ever per chatGuestId (date is constant).
//  - premium_daily: one row per PremiumUser per calendar day.
// Also the lookup path used on every request.
chatUsageSchema.index({ identifier: 1, kind: 1, date: 1 }, { unique: true });

export default mongoose.model("ChatUsage", chatUsageSchema);
