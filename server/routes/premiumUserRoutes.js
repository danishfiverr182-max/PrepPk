/**
 * server/routes/premiumUserRoutes.js
 *
 * Admin-only CRUD routes for premium users.
 * Category-level access routes have been removed   premium users now have
 * access to all categories automatically.
 */

import express from "express";
import {
  createUser,
  getAllUsers,
  getUser,
  retrievePassword,
  resetPassword,
  deleteUser,
  extendUser,
  forceLogout,
  updateFavoriteCategories,
} from "../controllers/premiumUserController.js";
import { protect } from "../middleware/adminAuth.js";
import PremiumUser from "../models/PremiumUser.js";
import { generateUserPassword } from "../utils/passwordGenerator.js";

const router = express.Router();

// GET /api/admin/users/model-check
router.get("/model-check", protect, async (_req, res) => {
  try {
    const totalUsers = await PremiumUser.countDocuments();
    return res.json({ status: "ok", totalUsers });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
});

// GET /api/admin/users/generate-password
router.get("/generate-password", protect, (_req, res) => {
  const password = generateUserPassword();
  return res.json({ password });
});

// GET /api/admin/users/expiring-soon    accounts expiring within next 3 days
router.get("/expiring-soon", protect, async (_req, res) => {
  try {
    const now   = new Date();
    const limit = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const users = await PremiumUser.find(
      { expiresAt: { $gte: now, $lte: limit }, isActive: true },
      "email expiresAt"
    ).lean();

    const result = users.map((u) => ({
      email:         u.email,
      expiresAt:     u.expiresAt,
      daysRemaining: Math.ceil((new Date(u.expiresAt) - Date.now()) / (1000 * 60 * 60 * 24)),
    }));

    return res.json({ users: result });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// All CRUD routes are admin-protected
router.post(  "/",                          protect, createUser);
router.get(   "/",                          protect, getAllUsers);
router.get(   "/:userId",                   protect, getUser);
router.get(   "/:userId/retrieve-password", protect, retrievePassword);
router.post(  "/:userId/reset-password",    protect, resetPassword);
router.delete("/:id",                       protect, deleteUser);
router.patch( "/:id/extend",               protect, extendUser);
router.patch( "/:id/favorite-categories",  protect, updateFavoriteCategories);
router.post( "/:userId/force-logout",       protect, forceLogout);

export default router;
