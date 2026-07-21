/**
 * routes/publicSettings.js  (Prompt 65 + 66)
 *
 * GET /api/settings/contact  public, no auth required
 *
 * Returns contact fields AND pricing fields from the singleton
 * AdminSettings document so both the Footer and PremiumPopup
 * can read them from one endpoint.
 *
 * Never returns internal/admin-only fields.
 * Always returns safe defaults never 404s or crashes the page.
 */

import express from "express";
import AdminSettings from "../models/AdminSettings.js";

const router = express.Router();

router.get("/contact", async (_req, res) => {
  try {
    const settings = await AdminSettings.findOne({ _singleton: true })
      .select("phone whatsappNumber email weekPrice monthPrice monthOriginalPrice aiChatbotEnabled")
      .lean();

    // Cache for 5 minutes pricing rarely changes
    res.set("Cache-Control", "public, max-age=300");

    if (!settings) {
      // No seed doc yet return empty/default values
      return res.json({
        phone:              "",
        whatsappNumber:     "",
        email:              "",
        weekPrice:          300,
        monthPrice:         1000,
        monthOriginalPrice: 1200,
        aiChatbotEnabled:   true,
      });
    }

    return res.json({
      phone:              settings.phone              || "",
      whatsappNumber:     settings.whatsappNumber     || "",
      email:              settings.email              || "",
      weekPrice:          settings.weekPrice          ?? 300,
      monthPrice:         settings.monthPrice         ?? 1000,
      monthOriginalPrice: settings.monthOriginalPrice ?? 1200,
      aiChatbotEnabled:   settings.aiChatbotEnabled   ?? true,
    });
  } catch (err) {
    console.error("[publicSettings] GET /contact →", err.message);
    return res.json({
      phone:              "",
      whatsappNumber:     "",
      email:              "",
      weekPrice:          300,
      monthPrice:         1000,
      monthOriginalPrice: 1200,
      aiChatbotEnabled:   true,
    });
  }
});

export default router;
