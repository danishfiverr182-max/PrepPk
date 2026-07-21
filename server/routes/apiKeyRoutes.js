/**
 * routes/apiKeyRoutes.js  (Part 12   Multi-provider API Key Vault)
 *
 * All routes protected by verifyAdmin, same pattern as adminSettings.js.
 *
 *   POST   /api/admin/api-keys              create a new vault entry
 *   GET    /api/admin/api-keys              list all entries (no keys)
 *   PATCH  /api/admin/api-keys/:id/toggle   flip isActive
 *   DELETE /api/admin/api-keys/:id          remove an entry
 *   POST   /api/admin/api-keys/:id/test     decrypt + test-call the key
 */

import express from "express";
import verifyAdmin from "../middleware/verifyAdmin.js";
import {
  createKey,
  listKeys,
  toggleKey,
  deleteKey,
  testKey,
} from "../controllers/apiKeyController.js";

const router = express.Router();

router.post("/api-keys", verifyAdmin, createKey);
router.get("/api-keys", verifyAdmin, listKeys);
router.patch("/api-keys/:id/toggle", verifyAdmin, toggleKey);
router.delete("/api-keys/:id", verifyAdmin, deleteKey);
router.post("/api-keys/:id/test", verifyAdmin, testKey);

export default router;
