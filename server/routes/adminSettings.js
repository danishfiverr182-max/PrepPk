/**
 * routes/adminSettings.js  (Prompt 65 + 66)
 *
 * PATCH /api/admin/settings  protected by verifyAdmin
 *
 * Allows the admin dashboard to update contact info and/or pricing
 * without redeploying. Only whitelisted fields are writable.
 */

import express from "express";
import verifyAdmin from "../middleware/verifyAdmin.js";
import AdminSettings from "../models/AdminSettings.js";

const router = express.Router();

router.patch("/settings", verifyAdmin, async (req, res) => {
  try {
    const {
      phone, whatsappNumber, email,
      weekPrice, monthPrice, monthOriginalPrice,
      aiChatbotEnabled,
    } = req.body;

    const updates = {};

    // Contact fields
    if (phone          !== undefined) updates.phone          = String(phone).trim();
    if (whatsappNumber !== undefined) updates.whatsappNumber = String(whatsappNumber).trim();
    if (email          !== undefined) updates.email          = String(email).trim();

    // Pricing fields
    if (weekPrice          !== undefined) updates.weekPrice          = Number(weekPrice);
    if (monthPrice         !== undefined) updates.monthPrice         = Number(monthPrice);
    if (monthOriginalPrice !== undefined) updates.monthOriginalPrice = Number(monthOriginalPrice);

    // AI Chatbot kill switch (Part 11   Prompt 5)
    if (aiChatbotEnabled !== undefined) updates.aiChatbotEnabled = Boolean(aiChatbotEnabled);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields provided to update." });
    }

    const updated = await AdminSettings.findOneAndUpdate(
      { _singleton: true },
      { $set: updates },
      { upsert: true, returnDocument: "after" }
    );

    return res.json({
      message: "Settings updated.",
      settings: {
        phone:              updated.phone,
        whatsappNumber:     updated.whatsappNumber,
        email:              updated.email,
        weekPrice:          updated.weekPrice,
        monthPrice:         updated.monthPrice,
        monthOriginalPrice: updated.monthOriginalPrice,
        aiChatbotEnabled:   updated.aiChatbotEnabled,
      },
    });
  } catch (err) {
    console.error("[adminSettings] PATCH /settings →", err.message);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
