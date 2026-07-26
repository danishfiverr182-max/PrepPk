/**
 * models/AdminSettings.js  (Prompt 65 + 66)
 *
 * Singleton settings document only one document should ever exist.
 * Contact fields (Prompt 65) + Pricing fields (Prompt 66).
 *
 * Use scripts/seedSettings.js to create/update the document.
 */

import mongoose from "mongoose";

const adminSettingsSchema = new mongoose.Schema(
  {
    // ── Contact (Prompt 65) ───────────────────────────────────
    phone:          { type: String, default: "" },
    whatsappNumber: { type: String, default: "" },
    email:          { type: String, default: "" },

    // ── Pricing (Prompt 66) ───────────────────────────────────
    weekPrice:           { type: Number, default: 300  },
    monthPrice:          { type: Number, default: 1000 },
    monthOriginalPrice:  { type: Number, default: 1200 },

    // ── AI Chatbot kill switch (Part 11   Prompt 5) ───────────
    // Lets the admin instantly hide the floating chat widget site-wide
    // (e.g. if the free Groq quota runs out) without a redeploy.
    aiChatbotEnabled: { type: Boolean, default: true },

    // ── Blog reading-page theme ────────────────────────────────
    // "classic" the original blog post layout (BlogPostPage.jsx).
    // "medium"  the Medium-inspired distraction-free reading layout
    // (MediumBlogPostPage.jsx). Site-wide switch: every published post
    // instantly renders in whichever layout is selected here, no
    // per-post edits required. Reversible at any time.
    blogTheme: { type: String, enum: ["classic", "medium"], default: "classic" },

    // Sentinel ensures findOneAndUpdate upsert is always safe
    _singleton: { type: Boolean, default: true, unique: true },
  },
  { timestamps: true }
);

const AdminSettings = mongoose.model("AdminSettings", adminSettingsSchema);
export default AdminSettings;
